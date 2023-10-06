# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class Forecast(models.Model):
    _inherit = 'planning.slot'

    allow_timesheets = fields.Boolean("Allow timesheets", related='project_id.allow_timesheets', help="Timesheets can be logged on this slot.", readonly=True)
    effective_hours = fields.Float("Effective Hours", compute='_compute_effective_hours', compute_sudo=True, store=True, help="Number of hours on the employee's Timesheets for this task (and its sub-tasks) during the timeframe of the shift.")
    percentage_hours = fields.Float("Progress", compute='_compute_percentage_hours', compute_sudo=True, store=True)

    @api.depends('allocated_hours', 'effective_hours')
    def _compute_percentage_hours(self):
        for forecast in self:
            if forecast.allocated_hours:
                forecast.percentage_hours = forecast.effective_hours / forecast.allocated_hours
            else:
                forecast.percentage_hours = 0

    @api.depends('task_id', 'employee_id', 'start_datetime', 'end_datetime', 'project_id.analytic_account_id', 'task_id.timesheet_ids', 'project_id.analytic_account_id.line_ids', 'project_id.analytic_account_id.line_ids.unit_amount')
    def _compute_effective_hours(self):
        Timesheet = self.env['account.analytic.line']
        for forecast in self:
            if (not forecast.task_id and not forecast.project_id) or not forecast.start_datetime or not forecast.end_datetime:
                forecast.effective_hours = 0
            else:
                domain = [
                    ('employee_id', '=', forecast.employee_id.id),
                    ('date', '>=', forecast.start_datetime.date()),
                    ('date', '<=', forecast.end_datetime.date())
                ]
                if forecast.task_id:
                    all_task = forecast.task_id + forecast.task_id._get_all_subtasks()
                    timesheets = Timesheet.search(expression.AND([[('task_id', 'in', all_task.ids)], domain]))
                elif forecast.project_id:
                    timesheets = Timesheet.search(expression.AND([[('account_id', '=', forecast.project_id.analytic_account_id.id)], domain]))
                else:
                    timesheets = Timesheet.browse()

                forecast.effective_hours = sum(timesheet.unit_amount for timesheet in timesheets)
