# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrAppraisalGoal(models.Model):
    _name = "hr.appraisal.goal"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = "Appraisal Goal"

    name = fields.Char(required=True)
    employee_id = fields.Many2one('hr.employee', string="Owner",
        default=lambda self: self.env.user.employee_id, required=True)
    manager_id = fields.Many2one('hr.employee', string="Challenged By", required=True)
    progression = fields.Selection(selection=[
        ('0', '0 %'),
        ('25', '25 %'),
        ('50', '50 %'),
        ('75', '75 %'),
        ('100', '100 %')
    ], string="Progression", default="0", required=True)
    description = fields.Text()
    deadline = fields.Date()
    is_manager = fields.Boolean(compute='_compute_is_manager')

    def _compute_is_manager(self):
        appraisal_user = self.env.user.has_group('hr_appraisal.group_hr_appraisal_user')
        self.update({'is_manager': appraisal_user})

    def action_confirm(self):
        self.write({'progression': '100'})
