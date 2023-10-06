# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests import tagged
from odoo.addons.sale_timesheet.tests.common import TestCommonSaleTimesheet

@tagged('-at_install', 'post_install')
class TestHelpdeskSaleTimesheet(TestCommonSaleTimesheet):

    def setUp(self):
        super(TestHelpdeskSaleTimesheet, self).setUp()

        self.helpdesk_team = self.env['helpdesk.team'].create({
            'name': 'Test Team',
            'use_helpdesk_timesheet': True,
            'use_helpdesk_sale_timesheet': True,
        })
        self.helpdesk_ticket = self.env['helpdesk.ticket'].create({
            'name': 'Test Ticket',
            'team_id': self.helpdesk_team.id,
            'partner_id': self.partner_a.id,
        })

    def test_change_customer_and_SOL_after_invoiced_timesheet(self):
        sale_order = self.env['sale.order'].create({
            'partner_id': self.partner_a.id,
            'partner_invoice_id': self.partner_a.id,
            'partner_shipping_id': self.partner_a.id,
        })
        so_line_order_no_task = self.env['sale.order.line'].create({
            'name': self.product_delivery_timesheet1.name,
            'product_id': self.product_delivery_timesheet1.id,
            'product_uom_qty': 1,
            'product_uom': self.product_delivery_timesheet1.uom_id.id,
            'price_unit': self.product_delivery_timesheet1.list_price,
            'order_id': sale_order.id,
        })

        sale_order.action_confirm()

        timesheet_entry = self.env['account.analytic.line'].create({
            'name': 'the only timesheet. So lonely...',
            'helpdesk_ticket_id': self.helpdesk_ticket.id,
            'project_id': self.helpdesk_team.project_id.id,
            'unit_amount': 3,
        })
        self.helpdesk_ticket.write({
            'sale_line_id': so_line_order_no_task.id,
        })

        self.assertEqual(timesheet_entry.partner_id, self.partner_a, "The Timesheet entry's partner should be equal to the ticket's partner/customer")

        invoice = sale_order._create_invoices()
        invoice.action_post()

        timesheet_entry_2 = self.env['account.analytic.line'].create({
            'name': 'A brother for the lonely timesheet',
            'helpdesk_ticket_id': self.helpdesk_ticket.id,
            'project_id': self.helpdesk_team.project_id.id,
            'unit_amount': 2,
        })

        self.helpdesk_ticket.write({'partner_id': self.partner_b.id})

        self.assertEqual(timesheet_entry.partner_id, self.partner_a, "The invoiced and posted Timesheet entry should have its partner unchanged")
        self.assertEqual(timesheet_entry_2.partner_id, self.partner_b, "The second Timesheet entry should have its partner changed, as it was not invoiced and posted")
