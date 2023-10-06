# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestQualityCommon(common.TransactionCase):

    def setUp(self):
        super(TestQualityCommon, self).setUp()

        self.product = self.env['product.product'].create({
        	'name': 'Office Chair'
        })
        self.product_tmpl_id = self.product.product_tmpl_id.id
        self.partner_id = self.env['res.partner'].create({'name': 'A Test Partner'}).id
        self.picking_type_id = self.ref('stock.picking_type_in')
        self.location_id = self.ref('stock.stock_location_suppliers')
        self.location_dest_id = self.ref('stock.stock_location_stock')
