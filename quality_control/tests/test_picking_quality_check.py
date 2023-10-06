# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .test_common import TestQualityCommon
from odoo.tests import Form

class TestQualityCheck(TestQualityCommon):

    def test_00_picking_quality_check(self):

        """Test quality check on incoming shipment."""

        # Create Quality Point for incoming shipment.
        self.qality_point_test = self.env['quality.point'].create({
            'product_ids': [(4, self.product.id)],
            'picking_type_ids': [(4, self.picking_type_id)],
        })

        # Check that quality point created.
        self.assertTrue(self.qality_point_test, "First Quality Point not created for Laptop Customized.")

        # Create incoming shipment.
        self.picking_in = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_id,
            'partner_id': self.partner_id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id,
        })
        self.env['stock.move'].create({
            'name': self.product.name,
            'product_id': self.product.id,
            'product_uom_qty': 2,
            'product_uom': self.product.uom_id.id,
            'picking_id': self.picking_in.id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id})

        # Check that incoming shipment is created.
        self.assertTrue(self.picking_in, "Incoming shipment not created.")

        # Confirm incoming shipment.
        self.picking_in.action_confirm()

        # Check Quality Check for incoming shipment is created and check it's state is 'none'.
        self.assertEqual(len(self.picking_in.check_ids), 1)
        self.assertEqual(self.picking_in.check_ids.quality_state, 'none')

        # 'Pass' Quality Checks of incoming shipment.
        self.picking_in.check_ids.do_pass()

        # Validate incoming shipment.
        self.picking_in.button_validate()

        # Now check state of quality check.
        self.assertEqual(self.picking_in.check_ids.quality_state, 'pass')

    def test_01_picking_quality_check_type_text(self):

        """ Test a Quality Check on a picking with 'Instruction'
        as test type.
        """
        # Create Quality Point for incoming shipment with 'Instructions' as test type
        self.qality_point_test = self.env['quality.point'].create({
            'product_ids': [(4, self.product.id)],
            'picking_type_ids': [(4, self.picking_type_id)],
            'test_type_id': self.env.ref('quality.test_type_instructions').id
        })

        # Check that quality point created.
        self.assertTrue(self.qality_point_test, "Quality Point not created")

        # Create incoming shipment.
        self.picking_in = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_id,
            'partner_id': self.partner_id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id,
        })
        self.env['stock.move'].create({
            'name': self.product.name,
            'product_id': self.product.id,
            'product_uom_qty': 2,
            'product_uom': self.product.uom_id.id,
            'picking_id': self.picking_in.id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id})

        # Check that incoming shipment is created.
        self.assertTrue(self.picking_in, "Incoming shipment not created.")

        # Confirm incoming shipment.
        self.picking_in.action_confirm()

        # Check Quality Check for incoming shipment is created and check it's state is 'none'.
        self.assertEqual(len(self.picking_in.check_ids), 1)
        self.assertEqual(self.picking_in.check_ids.quality_state, 'none')

        # Check that the Quality Check on the picking has 'instruction' as test_type
        self.assertEqual(self.picking_in.check_ids[0].test_type, 'instructions')

    def test_02_picking_quality_check_type_picture(self):

        """ Test a Quality Check on a picking with 'Take Picture'
        as test type.
        """
        # Create Quality Point for incoming shipment with 'Take Picture' as test type
        self.qality_point_test = self.env['quality.point'].create({
            'product_ids': [(4, self.product.id)],
            'picking_type_ids': [(4, self.picking_type_id)],
            'test_type_id': self.env.ref('quality.test_type_picture').id
        })
        # Check that quality point created.
        self.assertTrue(self.qality_point_test, "Quality Point not created")
        # Create incoming shipment.
        self.picking_in = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_id,
            'partner_id': self.partner_id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id,
        })
        self.env['stock.move'].create({
            'name': self.product.name,
            'product_id': self.product.id,
            'product_uom_qty': 2,
            'product_uom': self.product.uom_id.id,
            'picking_id': self.picking_in.id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id})
        # Check that incoming shipment is created.
        self.assertTrue(self.picking_in, "Incoming shipment not created.")
        # Confirm incoming shipment.
        self.picking_in.action_confirm()
        # Check Quality Check for incoming shipment is created and check it's state is 'none'.
        self.assertEqual(len(self.picking_in.check_ids), 1)
        self.assertEqual(self.picking_in.check_ids.quality_state, 'none')

        # Check that the Quality Check on the picking has 'picture' as test_type
        self.assertEqual(self.picking_in.check_ids[0].test_type, 'picture')

    def test_checks_removal_on_SM_cancellation(self):
        """
        Configuration:
            - 2 storable products P1 and P2
            - Receipt in 2 steps
            - QCP for internal pickings
        Process a first receipt with P1 and P2 (an internal picking and two
        quality checks are created)
        Process a second receipt with P1. The SM input->stock should be merged
        into the existing one and the quality checks should still exist
        """
        warehouse = self.env['stock.warehouse'].search([], limit=1)
        warehouse.reception_steps = 'two_steps'

        p01, p02 = self.env['product.product'].create([{
            'name': name,
            'type': 'product',
        } for name in ('SuperProduct01', 'SuperProduct02')])

        self.env['quality.point'].create([{
            'product_ids': [(4, product.id)],
            'picking_type_ids': [(4, warehouse.int_type_id.id)],
        } for product in (p01, p02)])

        receipt = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_id,
            'partner_id': self.partner_id,
            'location_id': self.location_id,
            'location_dest_id': warehouse.wh_input_stock_loc_id.id,
        })
        self.env['stock.move'].create([{
            'name': product.name,
            'product_id': product.id,
            'product_uom_qty': 1,
            'product_uom': product.uom_id.id,
            'picking_id': receipt.id,
            'location_id': self.location_id,
            'location_dest_id': warehouse.wh_input_stock_loc_id.id,
        } for product in (p01, p02)])
        receipt.action_confirm()
        receipt.move_lines.quantity_done = 1
        receipt.button_validate()

        internal_transfer = self.env['stock.picking'].search(
            [('location_id', '=', warehouse.wh_input_stock_loc_id.id), ('picking_type_id', '=', warehouse.int_type_id.id)],
            order='id desc', limit=1)
        self.assertEqual(internal_transfer.check_ids.product_id, p01 + p02)

        receipt = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_id,
            'partner_id': self.partner_id,
            'location_id': self.location_id,
            'location_dest_id': warehouse.wh_input_stock_loc_id.id,
        })
        self.env['stock.move'].create({
            'name': p01.name,
            'product_id': p01.id,
            'product_uom_qty': 1,
            'product_uom': p01.uom_id.id,
            'picking_id': receipt.id,
            'location_id': self.location_id,
            'location_dest_id': warehouse.wh_input_stock_loc_id.id,
        })
        receipt.action_confirm()
        receipt.move_lines.quantity_done = 1
        receipt.button_validate()

        self.assertRecordValues(internal_transfer.move_lines, [
            {'product_id': p01.id, 'product_uom_qty': 2},
            {'product_id': p02.id, 'product_uom_qty': 1},
        ])
        self.assertEqual(internal_transfer.check_ids.product_id, p01 + p02)

    def test_quality_check_with_backorder(self):
        """Test that a user without quality manager access rights can create a backorder"""
        # Create a user wtih stock and quality user rights
        user = self.env['res.users'].create({
            'name': 'Inventory Manager',
            'login': 'test',
            'email': 'test@test.com',
            'groups_id': [(6, 0, [self.env.ref('stock.group_stock_user').id, self.env.ref('quality.group_quality_user').id])]
        })

        picking = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id,
        })
        move = self.env['stock.move'].create({
            'name': self.product.name,
            'product_id': self.product.id,
            'product_uom_qty': 2,
            'product_uom': self.product.uom_id.id,
            'picking_id': picking.id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id,
        })
        picking.action_confirm()
        self.env['quality.point'].create({
            'product_ids': [(4, self.product.id)],
            'picking_type_ids': [(4, self.picking_type_id)],
            'measure_frequency_type': 'all',
        })
        move.quantity_done = 1.0
        # # 'Pass' Quality Checks of shipment.
        # picking.check_ids.do_pass()
        # Validate the picking and create a backorder
        backorder_wizard_dict = picking.button_validate()
        backorder_wizard = Form(self.env[backorder_wizard_dict['res_model']].with_context(backorder_wizard_dict['context'])).save()
        backorder_wizard.with_user(user).process()

        # Check that the backorder is created and in assigned state
        self.assertEqual(picking.state, 'done')
        backorder = picking.backorder_ids
        self.assertEqual(backorder.state, 'assigned')
        # 'Pass' Quality Checks of backorder.
        backorder.check_ids.do_pass()
        # Validate the backorder
        backorder.move_lines.quantity_done = 1.0
        backorder.with_user(user).button_validate()
        self.assertEqual(backorder.state, 'done')
