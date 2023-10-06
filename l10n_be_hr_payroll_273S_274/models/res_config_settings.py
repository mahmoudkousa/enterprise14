# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_be_company_number = fields.Char('Company Number', related='company_id.l10n_be_company_number', readonly=False)
    l10n_be_revenue_code = fields.Char('Revenue Code', related='company_id.l10n_be_revenue_code', readonly=False)
