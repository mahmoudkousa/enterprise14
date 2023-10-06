# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class QuantPackage(models.Model):
    _inherit = 'stock.quant.package'

    @api.model
    def _usable_packages_domain(self):
        domain = [('location_id', '=', False)]
        loc_id = self._context.get('pack_loc')
        if loc_id:
            domain = expression.OR([domain, [('location_id', 'child_of', loc_id)]])
        return domain

    @api.model
    def get_usable_packages_by_barcode(self):
        packages = self.env['stock.quant.package'].search_read(
            self._usable_packages_domain(),
            ['name', 'location_id'])
        packagesByBarcode = {package['name']: package for package in packages}
        return packagesByBarcode
