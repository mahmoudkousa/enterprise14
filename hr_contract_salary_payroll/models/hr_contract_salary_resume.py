# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrContractSalaryResume(models.Model):
    _inherit = 'hr.contract.salary.resume'

    value_type = fields.Selection(selection_add=[
        ('payslip', 'Payslip Value')
    ], ondelete={'payslip': 'set default'})
