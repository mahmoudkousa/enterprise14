# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_industry_fsm_quotations = fields.Boolean(string="Extra Quotations", implied_group="industry_fsm_sale.group_fsm_quotation_from_task")

    def set_values(self):
        fsm_projects = self.env['project.project'].sudo().search([('is_fsm', '=', True)])
        fsm_projects.sudo().write({'allow_quotations': self.group_industry_fsm_quotations})
        return super(ResConfigSettings, self).set_values()
