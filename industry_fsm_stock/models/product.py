# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ProductProduct(models.Model):
    _inherit = 'product.product'

    serial_missing = fields.Boolean(compute='_compute_serial_missing')
    quantity_decreasable = fields.Boolean(compute='_compute_quantity_decreasable')

    @api.depends('fsm_quantity')
    @api.depends_context('fsm_task_id')
    def _compute_serial_missing(self):
        task_id = self.env.context.get('fsm_task_id')
        if not task_id:
            self.serial_missing = False
            return

        task = self.env['project.task'].browse(task_id)
        sale_lines = self.env['sale.order.line'].sudo().search([('order_id', '=', task.sale_order_id.id), ('task_id', '=', task.id)])
        for product in self:
            if product.tracking != 'none':
                sale_product = sale_lines.filtered(lambda sale: sale.product_id == product)
                product.serial_missing = sale_product.filtered(lambda p: not p.fsm_lot_id and not p.qty_delivered)
            else:
                product.serial_missing = False

    @api.depends('fsm_quantity')
    @api.depends_context('fsm_task_id')
    def _compute_quantity_decreasable(self):
        # Compute if a product is already delivered. If a quantity is not yet delivered,
        # we can decrease the quantity
        task_id = self.env.context.get('fsm_task_id')
        if not task_id:
            self.quantity_decreasable = True
            return

        task = self.env['project.task'].browse(task_id)
        if not task or task.fsm_done:
            self.quantity_decreasable = False
            return
        elif task.sale_order_id.state in ['draft', 'sent']:
            self.quantity_decreasable = True
            return

        sale_lines = self.env['sale.order.line'].sudo().search([('order_id', '=', task.sale_order_id.id), ('task_id', '=', task.id)])

        for product in self:
            sale_product = sale_lines.filtered(lambda sale: sale.product_id == product)
            delivered_qty = sum(sale_product.mapped('qty_delivered'))
            asked_qty = sum(sale_product.mapped('product_uom_qty'))
            product.quantity_decreasable = delivered_qty != asked_qty

    def action_assign_serial(self):
        """ Opens a wizard to assign SN's name on each move lines.
        """
        self.ensure_one()
        if self.tracking == 'none':
            return False

        task_id = self.env.context.get('fsm_task_id')
        task = self.env['project.task'].browse(task_id)
        sale_lines = self.env['sale.order.line'].search([
            ('order_id', '=', task.sale_order_id.id), ('task_id', '=', task.id), ('product_id', '=', self.id), ('product_uom_qty', '>', 0)])
        tracking_line_ids = [(0, 0, {
            'lot_id': line.fsm_lot_id.id,
            'quantity': line.product_uom_qty - line.qty_delivered,
            'product_id': self.id,
            'sale_order_line_id': line.id,
            'company_id': task.sale_order_id.company_id.id,
        }) for line in sale_lines.filtered(lambda sl: sl.product_uom_qty - sl.qty_delivered and not task.fsm_done)]

        lot_done_dict = defaultdict(int)
        for move_line in sale_lines.move_ids.filtered(lambda m: m.state == 'done').move_line_ids:
            lot_done_dict[move_line.lot_id.id] += move_line.qty_done

        tracking_validated_line_ids = [(0, 0, {
            'lot_id': vals,
            'quantity': lot_done_dict[vals],
            'product_id': self.id,
            'company_id': task.sale_order_id.company_id.id,
        }) for vals in lot_done_dict]

        validation = self.env['fsm.stock.tracking'].create({
            'task_id': task_id,
            'product_id': self.id,
            'tracking_line_ids': tracking_line_ids,
            'tracking_validated_line_ids': tracking_validated_line_ids,
            'company_id': task.sale_order_id.company_id.id,
        })

        return {
            'name': _('Validate Lot/Serial Number'),
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_model': 'fsm.stock.tracking',
            'res_id': validation.id,
            'views': [(False, 'form')]
        }

    def set_fsm_quantity(self, quantity):
        old_qty = self.fsm_quantity
        res = super().set_fsm_quantity(quantity)

        if res and old_qty > quantity:
            # Check if we can remove from delivery order, else raise an error.
            qty2remove = old_qty - quantity
            delivery = self._get_contextual_fsm_task().sale_order_id.picking_ids
            if delivery:
                available_moves = delivery.move_lines.filtered(lambda d: d.state != 'done' and d.product_id == self)
                for move in available_moves:
                    removable = min(move.product_uom_qty - move.quantity_done, qty2remove)
                    qty2remove -= removable
                    move.product_uom_qty -= removable
                if qty2remove > 0:
                    raise UserError(_("You cannot have a quantity inferior to the number of items which have already been delivered."))

        return res
