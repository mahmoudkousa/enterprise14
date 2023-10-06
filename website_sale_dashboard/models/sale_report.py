# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class SaleReport(models.Model):
    _inherit = 'sale.report'

    is_abandoned_cart = fields.Boolean(string="Abandoned Cart", readonly=True)
    invoice_status = fields.Selection([
        ('upselling', 'Upselling Opportunity'),
        ('invoiced', 'Fully Invoiced'),
        ('to invoice', 'To Invoice'),
        ('no', 'Nothing to Invoice')
    ], string="Invoice Status", readonly=True)

    def _select_additional_fields(self, fields):
        res = super()._select_additional_fields(fields)
        res['is_abandoned_cart'] = """,
            s.date_order <= (timezone('utc', now()) - ((COALESCE(w.cart_abandoned_delay, '1.0') || ' hour')::INTERVAL))
            AND s.website_id IS NOT NULL
            AND s.state = 'draft'
            AND s.partner_id != %s
            AS is_abandoned_cart""" % self.env.ref('base.public_partner').id
        res['invoice_status'] = ', s.invoice_status AS invoice_status'
        return res

    def _from_sale(self, from_clause=''):
        res = super()._from_sale(from_clause)
        res += """
            LEFT JOIN website w ON w.id = s.website_id
            LEFT JOIN crm_team team ON team.id = s.team_id"""
        return res

    def _group_by_sale(self, groupby=''):
        res = super()._group_by_sale(groupby)
        res += """,
            w.cart_abandoned_delay,
            s.invoice_status"""
        return res
