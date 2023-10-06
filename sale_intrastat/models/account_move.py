# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    def _get_invoice_intrastat_country_id(self):
        # OVERRIDE
        self.ensure_one()
        partner = self.partner_shipping_id if self.is_sale_document() else self.partner_id
        if partner.country_id.intrastat:
            return partner.country_id.id
        return False

    @api.depends('partner_id', 'partner_shipping_id')
    def _compute_intrastat_country_id(self):
        for move in self:
            if move.is_sale_document():
                move.intrastat_country_id = move._get_invoice_intrastat_country_id()
            else:
                return super(AccountMove, self)._compute_intrastat_country_id()
