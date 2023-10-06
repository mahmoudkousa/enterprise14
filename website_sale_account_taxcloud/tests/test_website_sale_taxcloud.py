# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest.mock import patch

from odoo.addons.website.tools import MockRequest
from odoo.addons.website_sale_account_taxcloud.controllers.main import WebsiteSale
from odoo.tests.common import TransactionCase


class TestWebsiteSaleTaxCloud(TransactionCase):

    def setUp(self):
        super().setUp()

        self.website = self.env['website'].browse(1)
        self.WebsiteSaleController = WebsiteSale()

        self.acquirer = self.env.ref('payment.payment_acquirer_transfer')

        self.customer = self.env['res.partner'].create({
            'name': 'Theodore John K.',
        })

        self.fiscal_position = self.env['account.fiscal.position'].create({
            'name': 'BurgerLand',
            'is_taxcloud': True,
        })

        self.product = self.env['product.product'].create({
            'name': 'A',
            'list_price': 100,
            'sale_ok': True,
            'taxes_id': False,
        })

        self.order = self.env['sale.order'].create({
            'partner_id': self.customer.id,
            'fiscal_position_id': self.fiscal_position.id,
            'website_id': self.website.id,
            'order_line': [(0, 0, {
                'product_id': self.product.id,
                'product_uom_qty': 1,
            })]
        })

    def _verify_address(self, *args):
        return {
            'apiLoginID': '',
            'apiKey': '',
            'Address1': '',
            'Address2': '',
            'City': '',
            "State": '',
            "Zip5": '',
            "Zip4": '',
        }

    def _get_all_taxes_values(self):
        return {'values': {0: 10}}

    def test_recompute_taxes_before_payment(self):
        """
        Make sure that taxes are recomputed before payment
        """

        self.assertFalse(self.order.order_line[0].tax_id)

        with \
                patch.object(type(self.order), '_get_TaxCloudRequest', return_value=self.order._get_TaxCloudRequest("id", "api_key")),\
                patch('odoo.addons.account_taxcloud.models.taxcloud_request.TaxCloudRequest.verify_address', self._verify_address),\
                patch('odoo.addons.account_taxcloud.models.taxcloud_request.TaxCloudRequest.get_all_taxes_values', self._get_all_taxes_values),\
                MockRequest(self.env, website=self.website, sale_order_id=self.order.id):

            self.WebsiteSaleController.payment_transaction(
                self.acquirer.id, so_id=self.order.id)

        self.assertTrue(self.order.order_line[0].tax_id)
