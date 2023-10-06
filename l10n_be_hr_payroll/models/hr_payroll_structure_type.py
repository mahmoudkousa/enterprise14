# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrPayrollStructureType(models.Model):
    _inherit = 'hr.payroll.structure.type'

    time_credit_type_id = fields.Many2one(
        'hr.work.entry.type', string="Credit Time Work Entry Type",
        default=lambda self: self.env.ref('l10n_be_hr_payroll.work_entry_type_credit_time', raise_if_not_found=False),
        help="Work Entry Type to show for Credit Time")
