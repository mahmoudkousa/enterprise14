# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import ValidationError


class ResPartner(models.Model):
    _inherit = 'res.partner'

    subscription_count = fields.Integer(string='Subscriptions', compute='_subscription_count')

    def write(self, vals):
        res = super().write(vals)
        if 'active' in vals and not vals.get('active'):
            subs_ids = self.env['sale.subscription'].sudo().search([
                ('stage_id.category', '=', 'progress'),
                '|',
                ('partner_shipping_id', 'in', self.ids),
                ('partner_invoice_id', 'in', self.ids)
            ])
            if subs_ids:
                contract_str = ", ".join(subs_ids.mapped('name'))
                raise ValidationError(_("You can't archive the partner as it is used in the following recurring orders: %s", contract_str))
        return res

    def _subscription_count(self):
        # retrieve all children partners and prefetch 'parent_id' on them
        all_partners = self.with_context(active_test=False).search([('id', 'child_of', self.ids)])
        all_partners.read(['parent_id'])

        subscription_data = self.env['sale.subscription'].read_group(
            domain=[('partner_id', 'in', all_partners.ids)],
            fields=['partner_id'], groupby=['partner_id']
        )

        self.subscription_count = 0
        for group in subscription_data:
            partner = self.browse(group['partner_id'][0])
            while partner:
                if partner in self:
                    partner.subscription_count += group['partner_id_count']
                partner = partner.parent_id
