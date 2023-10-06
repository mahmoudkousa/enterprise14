# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class HrPayslipEmployees(models.TransientModel):
    _inherit = 'hr.payslip.employees'

    employee_ids = fields.Many2many(compute='_compute_employee_ids', store=True, readonly=False)
    department_id = fields.Many2one('hr.department')

    @api.depends('department_id')
    def _compute_employee_ids(self):
        for wizard in self.filtered(lambda w: w.department_id):
            wizard.employee_ids = self.env['hr.employee'].search(expression.AND([
                wizard._get_available_contracts_domain(),
                [('department_id', 'ilike', self.department_id.name)]
            ]))
