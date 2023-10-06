# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrContract(models.Model):
    _inherit = 'hr.contract'

    no_onss = fields.Boolean(string="No ONSS")
    no_withholding_taxes = fields.Boolean()
