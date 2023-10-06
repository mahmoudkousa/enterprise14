# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrAppraisal(models.Model):
    _inherit = "hr.appraisal"

    employee_feedback_ids = fields.Many2many('hr.employee', string="Asked Feedback")

    def action_ask_feedback(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'appraisal.ask.feedback',
            'target': 'new',
            'name': 'Ask Feedback',
        }

    def action_open_survey_inputs(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'name': "Survey Feedbacks",
            'target': 'self',
            'url': '/appraisal/%s/results/' % (self.id)
        }
