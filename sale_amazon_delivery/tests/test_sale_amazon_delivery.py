# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import TransactionCase


class TestAmazonDelivery(TransactionCase):

    def setUp(self):
        super().setUp()

        product = self.env['product.product'].create({'name': "This is a product"})
        self.carrier = self.env['delivery.carrier'].create(
            {'name': "My Truck", 'product_id': product.id}
        )  # delivery_type == 'fixed'
        self.picking = self.env['stock.picking'].create({
            'carrier_id': self.carrier.id,
            'location_id': self.env.ref('stock.location_pack_zone').id,
            'location_dest_id': self.env['ir.model.data'].xmlid_to_res_id(
                'stock.stock_location_customers'
            ),
            'picking_type_id': self.env['ir.model.data'].xmlid_to_res_id('stock.picking_type_out'),
        })

    def test_get_carrier_details_returns_carrier_name_when_unsupported(self):
        """Test that we fall back on the custom carrier's name if it's not supported by Amazon."""
        carrier_name, _tracking_ref = self.picking._get_carrier_details()
        self.assertEqual(carrier_name, self.carrier.name)

    def test_get_carrier_details_returns_formatted_carrier_name_when_supported(self):
        """Test that we use the formatted carrier name when it is supported by Amazon."""
        self.carrier.name = 'd_H l)'
        carrier_name, _tracking_ref = self.picking._get_carrier_details()
        self.assertEqual(carrier_name, 'DHL')
