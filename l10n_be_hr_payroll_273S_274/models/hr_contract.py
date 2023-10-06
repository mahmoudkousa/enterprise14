# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class HrContract(models.Model):
    _inherit = 'hr.contract'

    # YTI: Check it is correctly transfered at appraisal
    rd_percentage = fields.Integer("Time Percentage in R&D")

    @api.constrains('rd_percentage')
    def _check_discount_percentage(self):
        if self.filtered(lambda c: c.rd_percentage < 0 or c.rd_percentage > 100):
            raise ValidationError(_('The time Percentage in R&D should be between 1-100'))
        for contract in self:
            if contract.rd_percentage and contract.employee_id.certificate not in ['civil_engineer', 'doctor', 'master', 'bachelor']:
                raise ValidationError(_('Only employeers with a Bachelor/Master/Doctor/Civil Engineer degree can benefit from the withholding taxes exemption.'))
