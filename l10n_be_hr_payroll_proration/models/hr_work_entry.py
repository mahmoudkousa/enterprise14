#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class HrWorkEntryType(models.Model):
    _inherit = 'hr.work.entry.type'

    private_car = fields.Boolean(
        string="Private Car Reimbursement",
        help="Work entries counts for private car reimbursement")
    representation_fees = fields.Boolean(
        string="Representation Fees",
        help="Work entries counts for representation fees")

    @api.model
    def get_work_entry_type_benefits(self):
        return ['meal_voucher', 'private_car', 'representation_fees']
