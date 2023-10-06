# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrEmployeeBase(models.AbstractModel):
    _inherit = "hr.employee.base"
    _description = "Basic Employee"

    parent_user_id = fields.Many2one(related='parent_id.user_id', string="Parent User")
    last_appraisal_id = fields.Many2one('hr.appraisal')

    def action_send_appraisal_request(self):
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'request.appraisal',
            'target': 'new',
            'name': 'Appraisal Request',
            'context': self.env.context,
        }
