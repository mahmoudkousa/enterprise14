# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    version = fields.Integer('Version', default=1, help="The current version of the product.", copy=False)
    eco_count = fields.Integer('# ECOs',compute='_compute_eco_count')
    eco_ids = fields.One2many('mrp.eco', 'product_tmpl_id', 'ECOs')

    def _compute_eco_count(self):
        for p in self:
            p.eco_count = len(p.eco_ids)
