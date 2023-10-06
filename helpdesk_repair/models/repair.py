# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Repair(models.Model):
    _inherit = 'repair.order'

    ticket_id = fields.Many2one('helpdesk.ticket', string="Ticket", help="Related Helpdesk Ticket")

    def action_repair_done(self):
        """repair.action_repair_done() calls stock_move.create() which,
        if default_lot_id is still in the context, will give all stock_move_lines.lot_id this value.
        We want to avoid that, as the components of the repair do not have the same lot_id, if any,
        so it leads to an exception.
        """
        context = dict(self.env.context)
        context.pop('default_lot_id', None)
        return super(Repair, self.with_context(context)).action_repair_done()
