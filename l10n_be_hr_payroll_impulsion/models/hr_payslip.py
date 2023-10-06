# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    def _get_base_local_dict(self):
        res = super()._get_base_local_dict()
        res.update({
            'compute_impulsion_plan_amount': compute_impulsion_plan_amount,
        })
        return res

def compute_impulsion_plan_amount(payslip, categories, worked_days, inputs):
    start = payslip.dict.employee_id.first_contract_date
    end = payslip.dict.date_to
    number_of_months = (end.year - start.year) * 12 + (end.month - start.month)
    numerator = sum(wd.number_of_hours for wd in payslip.dict.worked_days_line_ids if wd.amount > 0)
    denominator = 4 * payslip.dict.contract_id.resource_calendar_id.hours_per_week
    coefficient = numerator / denominator
    if payslip.dict.contract_id.l10n_be_impulsion_plan == '25yo':
        if 0 <= number_of_months <= 23:
            theorical_amount = 500.0
        elif 24 <= number_of_months <= 29:
            theorical_amount = 250.0
        elif 30 <= number_of_months <= 35:
            theorical_amount = 125.0
        else:
            theorical_amount = 0
        return min(theorical_amount, theorical_amount * coefficient)
    elif payslip.dict.contract_id.l10n_be_impulsion_plan == '12mo':
        if 0 <= number_of_months <= 11:
            theorical_amount = 500.0
        elif 12 <= number_of_months <= 17:
            theorical_amount = 250.0
        elif 18 <= number_of_months <= 23:
            theorical_amount = 125.0
        else:
            theorical_amount = 0
        return min(theorical_amount, theorical_amount * coefficient)
    else:
        return 0
