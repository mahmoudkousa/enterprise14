# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from odoo import api, exceptions, fields, models, _
from odoo.exceptions import UserError


class Project(models.Model):
    _inherit = 'project.project'

    allow_forecast = fields.Boolean("Planning", default=True, help="Enable planning tasks on the project.")
    total_forecast_time = fields.Integer(compute='_compute_total_forecast_time',
                                         help="Total number of forecast hours in the project rounded to the unit.")

    def _compute_total_forecast_time(self):
        for project in self:
            forecast_data = self.env['planning.slot'].search([('project_id', '=', project.id)])
            project.total_forecast_time = int(round(sum(slot.allocated_hours for slot in forecast_data)))

    def unlink(self):
        if self.env['planning.slot'].sudo().search_count([('project_id', 'in', self.ids)]) > 0:
            raise UserError(_('You cannot delete a project containing plannings. You can either delete all the project\'s forecasts and then delete the project or simply deactivate the project.'))
        return super(Project, self).unlink()

    @api.depends('is_fsm')
    def _compute_allow_forecast(self):
        for project in self:
            if not project._origin:
                project.allow_forecast = not project.is_fsm


class Task(models.Model):
    _inherit = 'project.task'

    allow_forecast = fields.Boolean('Allow Planning', readonly=True, related='project_id.allow_forecast', store=False)
    forecast_hours = fields.Integer('Forecast Hours', compute='_compute_forecast_hours', help="Number of hours forecast for this task (and its sub-tasks), rounded to the unit.")

    def _compute_forecast_hours(self):
        forecast_data = self.env['planning.slot'].read_group([('task_id', 'in', self.ids + self._get_all_subtasks().ids)], ['allocated_hours', 'task_id'], ['task_id'])
        mapped_data = dict([(f['task_id'][0], f['allocated_hours']) for f in forecast_data])
        for task in self:
            hours = mapped_data.get(task.id, 0) + sum(mapped_data.get(child_task.id, 0) for child_task in task._get_all_subtasks())
            task.forecast_hours = int(round(hours))

    def unlink(self):
        if self.env['planning.slot'].sudo().search_count([('task_id', 'in', self.ids)]) > 0:
            raise UserError(_('You cannot delete a task containing plannings. You can either delete all the task\'s plannings and then delete the task or simply deactivate the task.'))
        return super(Task, self).unlink()

    def action_get_project_forecast_by_user(self):
        allowed_task_ids = self.ids + self._get_all_subtasks().ids
        action = self.env["ir.actions.actions"]._for_xml_id("project_forecast.project_forecast_action_schedule_by_employee")
        first_slot = self.env['planning.slot'].search([('end_datetime', '>=', datetime.datetime.now()), ('task_id', 'in', allowed_task_ids)], limit=1, order="end_datetime asc")
        action_context = {
            'group_by': ['task_id', 'employee_id'],
        }
        if first_slot:
            action_context.update({'initialDate': first_slot.start_datetime})
        action['context'] = action_context
        action['domain'] = [('task_id', 'in', allowed_task_ids)]
        return action
