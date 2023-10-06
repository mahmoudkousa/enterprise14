# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class QuantPackage(models.Model):
    _inherit = 'stock.quant.package'

    package_use = fields.Selection([
        ('disposable', 'Disposable Box'),
        ('reusable', 'Reusable Box'),
        ], string='Package Use', default='disposable', required=True,
        help="""Reusable boxes are used for batch picking and emptied afterwards to be reused. In the barcode application, scanning a reusable box will add the products in this box.
        Disposable boxes aren't reused, when scanning a disposable box in the barcode application, the contained products are added to the transfer.""")

    @api.model
    def _usable_packages_domain(self):
        domain = super()._usable_packages_domain()
        return expression.OR([
            domain,
            [('package_use', '=', 'reusable')],
        ])

    def _allowed_to_move_between_transfers(self):
        self.ensure_one()
        return self.package_use == 'disposable'
