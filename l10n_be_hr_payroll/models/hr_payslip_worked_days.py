# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import pytz

from datetime import timedelta

from odoo import api, fields, models
from odoo.tools.float_utils import float_compare


class HrPayslipWorkedDays(models.Model):
    _inherit = 'hr.payslip.worked_days'

    is_credit_time = fields.Boolean(string='Credit Time')

    @api.depends('is_paid', 'is_credit_time', 'number_of_hours', 'payslip_id', 'contract_id.wage', 'payslip_id.sum_worked_hours')
    def _compute_amount(self):
        # YTI TODO master: This crappy hack can removed as soon as hr_payroll_edit_lines is merged into hr_payroll
        if 'edited' in self.payslip_id:
            self = self.filtered(lambda wd: not wd.payslip_id.edited)
        monthly_self = self.filtered(lambda wd: wd.payslip_id.wage_type == "monthly")

        credit_time_days = monthly_self.filtered(lambda worked_day: worked_day.is_credit_time)
        credit_time_days.update({'amount': 0})

        paid_be_wds = (monthly_self - credit_time_days).filtered(
            lambda wd: wd.payslip_id.struct_id.country_id.code == "BE" and wd.is_paid)

        if paid_be_wds:
            for be_wd in paid_be_wds:
                payslip = be_wd.payslip_id
                contract = payslip.contract_id
                calendar = payslip.contract_id.resource_calendar_id or payslip.employee_id.resource_calendar_id
                tz = pytz.timezone(calendar.tz)
                hours_per_week = calendar.hours_per_week
                wage = payslip._get_contract_wage() if payslip.contract_id else 0

                # If out of contract, we use the hourly formula to deduct the real wage
                out_be_wd = be_wd.payslip_id.worked_days_line_ids.filtered(lambda wd: wd.code == 'OUT')
                if out_be_wd:
                    out_hours = sum([wd.number_of_hours for wd in out_be_wd])
                    # Don't count out of contract time that actually was a credit time 
                    if payslip.contract_id.time_credit:
                        if contract.date_start > payslip.date_from:
                            start = payslip.date_from
                            end = contract.date_start
                            start_dt = tz.localize(fields.Datetime.to_datetime(start))
                            end_dt = tz.localize(fields.Datetime.to_datetime(end) + timedelta(days=1, seconds=-1))
                            credit_time_attendances = payslip.contract_id.resource_calendar_id._attendance_intervals_batch(start_dt, end_dt)[False]
                            standard_attendances = payslip.contract_id.standard_calendar_id._attendance_intervals_batch(start_dt, end_dt)[False]
                            out_hours -= sum([(stop - start).total_seconds() / 3600 for start, stop, dummy in standard_attendances - credit_time_attendances])
                        if contract.date_end and contract.date_end < payslip.date_to:
                            start = contract.date_end
                            end = payslip.date_to
                            start_dt = tz.localize(fields.Datetime.to_datetime(start))
                            end_dt = tz.localize(fields.Datetime.to_datetime(end) + timedelta(days=1, seconds=-1))
                            credit_time_attendances = payslip.contract_id.resource_calendar_id._attendance_intervals_batch(start_dt, end_dt)[False]
                            standard_attendances = payslip.contract_id.standard_calendar_id._attendance_intervals_batch(start_dt, end_dt)[False]
                            out_hours -= sum([(stop - start).total_seconds() / 3600 for start, stop, dummy in standard_attendances - credit_time_attendances])

                    out_ratio = 1 - 3 / (13 * hours_per_week) * out_hours if hours_per_week else 1
                else:
                    out_ratio = 1

                # For training time off: The maximum reimbursement is fixed by a threshold that you can 
                # find at https://www.leforem.be/entreprises/aides-financieres-conge-education-paye.html
                # In that case we have to adapt the wage.
                wage_to_deduct = 0
                max_hours_per_week = contract.standard_calendar_id.hours_per_week or contract.resource_calendar_id.hours_per_week
                training_ratio = 3 / (13 * max_hours_per_week) if max_hours_per_week else 0
                training_wds = paid_be_wds.filtered(lambda wd: wd.work_entry_type_id.code == "LEAVE260")
                if training_wds:
                    training_hours = sum(training_wds.mapped('number_of_hours'))
                    uncapped_training_amount = wage * 3 / 13 / max_hours_per_week * training_hours
                    training_threshold = self.env['hr.rule.parameter'].sudo()._get_parameter_from_code(
                        'training_time_off_threshold', payslip.date_to, raise_if_not_found=False)
                    # YTI: Could be dropped in master
                    if not training_threshold:
                        training_threshold = 2928.0
                    if wage > training_threshold:
                        hourly_wage_to_deduct = (wage - training_threshold) * training_ratio
                        wage_to_deduct = training_hours * hourly_wage_to_deduct

                ####################################################################################
                #  Example:
                #  Note: 3/13/38) * wage : hourly wage, if 13th months and 38 hours/week calendar
                #
                #  CODE     :   number_of_hours    :    Amount
                #  WORK100  :      130 hours       : (1 - 3/13/38 * (15 + 30)) * wage
                #  PAID     :      30 hours        : 3/13/38 * (15 + 30)) * wage
                #  UNPAID   :      15 hours        : 0
                #
                #  TOTAL PAID : WORK100 + PAID + UNPAID = (1 - 3/13/38 * 15 ) * wage
                ####################################################################################
                main_worked_day = "WORK100"
                if main_worked_day not in be_wd.payslip_id.worked_days_line_ids.mapped('code'):
                    main_worked_day = be_wd.payslip_id.worked_days_line_ids.filtered(
                        lambda wd: wd.is_paid and wd.code not in ['LEAVE300', 'LEAVE301'])
                    main_worked_day = main_worked_day[0].code if main_worked_day else False

                if be_wd.code == 'OUT':
                    worked_day_amount = 0
                elif wage_to_deduct and be_wd.code == 'LEAVE260':
                    worked_day_amount = min(wage, training_threshold) * training_ratio * training_hours
                elif be_wd.code == main_worked_day:  # WORK100 (Generally)
                    # Case with half days mixed with full days
                    work100_wds = be_wd.payslip_id.worked_days_line_ids.filtered(lambda wd: wd.code == "WORK100")
                    number_of_hours = sum([
                        wd.number_of_hours * (1 if wd.code != 'LEAVE510' else out_ratio)
                        for wd in be_wd.payslip_id.worked_days_line_ids
                        if wd.code not in [main_worked_day, 'OUT'] and not wd.is_credit_time])
                    if len(work100_wds) > 1:
                        # In this case, we cannot use the hourly formula since the monthly
                        # salary must always be the same, without having an identical number of
                        # working days

                        # If only presence -> Compute the full days from the hourly formula
                        if len(list(set(be_wd.payslip_id.worked_days_line_ids.mapped('code')))) == 1:
                            ratio = (out_ratio - 3 / (13 * hours_per_week) * number_of_hours) if hours_per_week else 0
                            worked_day_amount = wage * ratio
                            if float_compare(be_wd.number_of_hours, max(work100_wds.mapped('number_of_hours')), 2): # lowest lines
                                ratio = 3 / (13 * hours_per_week) * (work100_wds - be_wd).number_of_hours if hours_per_week else 0
                                worked_day_amount = worked_day_amount * (1 - ratio)
                            else:  # biggest line
                                ratio = 3 / (13 * hours_per_week) * be_wd.number_of_hours if hours_per_week else 0
                                worked_day_amount = worked_day_amount * ratio
                        # Mix of presence/absences - Compute the half days from the hourly formula
                        else:
                            if float_compare(be_wd.number_of_hours, max(work100_wds.mapped('number_of_hours')), 2): # lowest lines
                                ratio = 3 / (13 * hours_per_week) * be_wd.number_of_hours if hours_per_week else 0
                                worked_day_amount = wage * ratio
                                # ratio = 3 / (13 * hours_per_week) * (work100_wds - be_wd).number_of_hours if hours_per_week else 0
                                # worked_day_amount = worked_day_amount * (1 - ratio)
                            else:  # biggest line
                                total_wage = (out_ratio - 3 / (13 * hours_per_week) * number_of_hours) * wage if hours_per_week else 0
                                ratio = 3 / (13 * hours_per_week) * (work100_wds - be_wd).number_of_hours if hours_per_week else 0
                                worked_day_amount = total_wage - wage * ratio
                                # ratio = 3 / (13 * hours_per_week) * be_wd.number_of_hours if hours_per_week else 0
                                # worked_day_amount = worked_day_amount * ratio
                    else:
                        # Classic case : Only 1 WORK100 line
                        ratio = (out_ratio - 3 / (13 * hours_per_week) * number_of_hours) if hours_per_week else 0
                        worked_day_amount = wage * ratio
                else:
                    number_of_hours = be_wd.number_of_hours
                    ratio = 3 / (13 * hours_per_week) * number_of_hours if hours_per_week else 0
                    worked_day_amount = wage * ratio
                    if be_wd.code == 'LEAVE510':
                        worked_day_amount *= out_ratio
                    if worked_day_amount > wage:
                        worked_day_amount = wage
                be_wd.amount = worked_day_amount

        super(HrPayslipWorkedDays, self - credit_time_days - paid_be_wds)._compute_amount()
