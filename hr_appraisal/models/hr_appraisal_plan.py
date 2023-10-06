# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from dateutil.relativedelta import relativedelta

from werkzeug.urls import url_encode

from odoo import api, fields, models, _


class HrAppraisalPlan(models.Model):
    _name = "hr.appraisal.plan"
    _description = "Employee Appraisal Plan"

    duration = fields.Integer(string="Create a New Appraisal", default=6, required=True)
    event = fields.Selection([
        ('arrival', 'month after the arrival date'),
        ('last_appraisal', 'month after the last appraisal')
        ], string='After', required=True, default='last_appraisal')
    company_id = fields.Many2one('res.company', required=True, ondelete='cascade', default=lambda self: self.env.company)

    _sql_constraints = [
        ('positif_number_months', 'CHECK(duration > 0)', "The duration time must be bigger or equal to 1 month."),
    ]

    def name_get(self):
        result = []
        event_selection_vals = {elem[0]: elem[1] for elem in self._fields['event']._description_selection(self.env)}
        for plan in self:
            event_name = event_selection_vals[plan.event]
            result.append((plan.id, _('%s months %s') % (plan.duration, event_name)))
        return result

    def _action_create_new_appraisal(self, employees):
        days = int(self.env['ir.config_parameter'].sudo().get_param('hr_appraisal.appraisal_create_in_advance_days', 8))
        current_date = current_date = datetime.date.today()
        appraisal_values = [{
            'company_id': employee.company_id.id,
            'employee_id': employee.id,
            'date_close': fields.Date.to_string(current_date + relativedelta(days=days)),
            'manager_ids': [(4, employee.parent_id.id)] if employee.parent_id else False,
        } for employee in employees]
        return self.env['hr.appraisal'].create(appraisal_values)

    def _run_employee_appraisal_plans(self):
        companies = self.env['res.company'].search([('appraisal_plan', '=', True)])
        # only select compnay who want generate appraisals
        plans = self.search([('company_id', 'in', companies.ids)], order='duration')

        for duration_month in set(plans.mapped('duration')):
            for plan in plans.filtered(lambda r: r.duration == duration_month):
                employees = self.env['hr.employee']._get_appraisals_to_create_employees(duration_month, plan)
                if employees:
                    appraisals = self._action_create_new_appraisal(employees)
                    plan._generate_activities(appraisals)

    def _generate_activities(self, appraisals):
        self.ensure_one()
        for appraisal in appraisals:
            employee = appraisal.employee_id
            managers = appraisal.manager_ids
            if employee.user_id:
                if self.event == "arrival":
                    note = _("You arrived %s months ago. Your appraisal is created you can assess yourself here. Your manager will determinate the date for your '1to1' meeting.") % (self.duration) 
                else:
                    note = _("Your last appraisal was %s months ago. Your appraisal is created you can assess yourself here. Your manager will determinate the date for your '1to1' meeting.") % (self.duration)
                appraisal.with_context(mail_activity_quick_update=True).activity_schedule(
                    'mail.mail_activity_data_todo', fields.Date.today(),
                    summary=_('Appraisal to Confirm and Send'),
                    note=note, user_id=employee.user_id.id)
            for manager in managers.filtered(lambda m: m.user_id):
                if self.event == "arrival":
                    note = _("The employee %s arrived %s months ago. An appraisal for %s is created. You can assess %s & determinate the date for '1to1' meeting before %s") % (employee.name, self.duration, employee.name, employee.name, appraisal.date_close) 
                else:
                    note = _("Your employee's last appraisal was %s months ago. An appraisal for %s is created. You can assess %s & determinate the date for '1to1' meeting before %s") % (self.duration, employee.name, employee.name, appraisal.date_close)
                appraisal.with_context(mail_activity_quick_update=True).activity_schedule(
                    'mail.mail_activity_data_todo', fields.Date.today(),
                    summary=_('Appraisal to Confirm and Send'),
                    note=note, user_id=manager.user_id.id)
