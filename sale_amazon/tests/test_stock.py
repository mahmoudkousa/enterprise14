# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest.mock import patch, Mock

from odoo import fields
from odoo.exceptions import UserError

from odoo.addons.stock.tests.common import TestStockCommon


class TestStock(TestStockCommon):

    # As this test class is exclusively intended to test Amazon-related check on pickings, the
    # normal flows of stock are put aside in favor of manual updates on quantities.

    def setUp(self):
        super().setUp()
        partner = self.env['res.partner'].create({
            'name': "Gederic Frilson",
        })
        self.sale_order = self.env['sale.order'].create({
            'partner_id': partner.id,
            'order_line': [(0, 0, {
                'name': 'test',
                'product_id': self.productA.id,
                'product_uom_qty': 2,
                'amazon_item_ref': '123456789',
            })],
            'amazon_order_ref': '123456789',
        })
        self.picking = self.PickingObj.create({
            'picking_type_id': self.picking_type_in,
            'location_id': self.supplier_location,
            'location_dest_id': self.stock_location,
        })
        move_vals = {
            'name': self.productA.name,
            'product_id': self.productA.id,
            'product_uom_qty': 1,
            'product_uom': self.productA.uom_id.id,
            'picking_id': self.picking.id,
            'location_id': self.supplier_location,
            'location_dest_id': self.stock_location,
            'sale_line_id': self.sale_order.order_line[0].id,
        }
        self.move_1 = self.MoveObj.create(move_vals)
        self.move_2 = self.MoveObj.create(move_vals)
        self.picking.sale_id = self.sale_order.id  # After creating the moves as it clears the field

    def test_confirm_picking_trigger_SOL_check(self):
        """ Test that confirming a picking triggers a check on sales order lines completion. """

        with patch(
            'odoo.addons.sale_amazon.models.stock_picking.StockPicking'
            '._check_sales_order_line_completion', new=Mock()
        ) as mock:
            self.picking.date_done = fields.Datetime.now()  # Trigger the check for SOL completion
            self.assertEqual(
                mock.call_count, 1, "confirming a picking should trigger a check on the sales "
                                    "order lines completion"
            )

    def test_check_SOL_completion_no_move(self):
        """ Test that the check on SOL completion passes if no move is confirmed. """

        self.assertIsNone(
            self.picking._check_sales_order_line_completion(),
            "the check of SOL completion should not raise for pickings with completions of 0% (no"
            "confirmed move for a given sales order line)"
        )

    def test_check_SOL_completion_all_moves(self):
        """ Test that the check on SOL completion passes if all moves are confirmed. """

        self.move_1.quantity_done = 1
        self.move_2.quantity_done = 1
        self.assertIsNone(
            self.picking._check_sales_order_line_completion(),
            "the check of SOL completion should not raise for pickings with completions of 100% "
            "(all moves related to a given sales order line are confirmed)"
        )

    def test_check_SOL_completion_some_moves(self):
        """ Test that the check on SOL completion fails if only some moves are confirmed. """

        self.move_1.quantity_done = 1
        with self.assertRaises(UserError):
            # The check of SOL completion should raise for pickings with completions of ]0%, 100%[
            # (some moves related to a given sales order line are confirmed, but not all)
            self.picking._check_sales_order_line_completion()
