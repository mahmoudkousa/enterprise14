# -*- coding: utf-8 -*-
# Part of Odoo. See ICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ReturnPicking(models.TransientModel):
    _inherit = 'stock.return.picking'

    partner_id = fields.Many2one('res.partner', related="ticket_id.partner_id", string="Customer")
    ticket_id = fields.Many2one('helpdesk.ticket')
    sale_order_id = fields.Many2one('sale.order', related="ticket_id.sale_order_id", string='Sales Order')
    picking_id = fields.Many2one(domain="[('id', 'in', suitable_picking_ids)]")
    suitable_picking_ids = fields.Many2many('stock.picking', compute='_compute_suitable_picking_ids')

    @api.depends('ticket_id.sale_order_id.picking_ids', 'ticket_id.partner_id.commercial_partner_id')
    def _compute_suitable_picking_ids(self):
        for r in self:
            if not r.ticket_id and not r.sale_order_id:
                r.suitable_picking_ids = False
                continue

            domain = [('state', '=', 'done')]
            if r.sale_order_id:
                domain += [('id', 'in', r.sale_order_id.picking_ids._origin.ids)]
            elif r.partner_id:
                domain += [('partner_id', 'child_of', r.partner_id.commercial_partner_id._origin.id)]
            r.suitable_picking_ids = self.env['stock.picking'].search(domain)

    def create_returns(self):
        res = super(ReturnPicking, self).create_returns()
        picking_id = self.env['stock.picking'].browse(res['res_id'])
        if self.ticket_id:
            self.ticket_id.picking_ids |= picking_id
        else:
            ticket_id = self.env['helpdesk.ticket'].sudo().search([('picking_ids', 'in', self.picking_id.id)], limit=1)
            if ticket_id:
                ticket_id.picking_ids |= picking_id
        return res
