# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools import float_compare, float_round


class Task(models.Model):
    _inherit = "project.task"

    def action_fsm_validate(self):
        result = super(Task, self).action_fsm_validate()

        for task in self:
            if task.allow_billable and task.sale_order_id:
                task.sudo()._validate_stock()
        return result

    def _validate_stock(self):
        self.ensure_one()
        all_fsm_sn_moves = self.env['stock.move']
        ml_to_create = []
        for so_line in self.sale_order_id.order_line:
            if not (so_line.task_id.is_fsm or so_line.project_id.is_fsm or so_line.fsm_lot_id):
                continue
            qty = so_line.product_uom_qty - so_line.qty_delivered
            fsm_sn_moves = self.env['stock.move']
            if not qty:
                continue
            for last_move in so_line.move_ids.filtered(lambda p: p.state not in ['done', 'cancel'] and p.quantity_done < qty):
                move = last_move
                fsm_sn_moves |= last_move
                while move.move_orig_ids.filtered(lambda m: m.quantity_done < qty):
                    move = move.move_orig_ids
                    fsm_sn_moves |= move
            for fsm_sn_move in fsm_sn_moves:
                ml_vals = fsm_sn_move._prepare_move_line_vals(quantity=0)
                task = fsm_sn_move.sale_line_id.task_id
                # if the move_line of the delivery is linked to the current task or is a taskless product, set his qty_done accordinlgy
                if not task or task == self:
                    ml_vals['qty_done'] = qty - fsm_sn_move.quantity_done
                ml_vals['lot_id'] = so_line.fsm_lot_id.id
                if fsm_sn_move.product_id.tracking == "serial":
                    quants = self.env['stock.quant']._gather(fsm_sn_move.product_id, fsm_sn_move.location_id, lot_id=so_line.fsm_lot_id)
                    quant = quants.filtered(lambda q: q.quantity == 1.0)[:1]
                    ml_vals['location_id'] = quant.location_id.id or fsm_sn_move.location_id.id
                ml_to_create.append(ml_vals)
            all_fsm_sn_moves |= fsm_sn_moves
            # set the quantity delivered of the sol to the quantity ordered for the product linked to the task
            if so_line.task_id == self and not so_line.product_id.service_policy == 'delivered_timesheet':
                so_line.qty_delivered = so_line.product_uom_qty
        self.env['stock.move.line'].create(ml_to_create)

        def is_fsm_material_picking(picking, task):
            """ this function returns if the picking is a picking ready to be validated. """
            for move in picking.move_lines:
                while move.move_dest_ids:
                    move = move.move_dest_ids
                sol = move.sale_line_id
                if sol.fsm_lot_id:
                    continue
                if not (sol.product_id != task.project_id.timesheet_product_id \
                and sol != task.sale_line_id \
                and sol.product_uom_qty != 0 \
                # On the last and, we check if the task is either done (and thus already done for the delivery) or the current one (and thus about to be validated)
                # if not, we can not validate the delivery
                and (sol.task_id == task or sol.task_id.fsm_done)):
                    return False
            return True

        pickings_to_do = self.sale_order_id.picking_ids.filtered(lambda p: p.state not in ['done', 'cancel'] and is_fsm_material_picking(p, self))
        # set the quantity done as the initial demand before validating the pickings
        for move in pickings_to_do.move_lines:
            if move.state in ('done', 'cancel') or move in all_fsm_sn_moves:
                continue
            rounding = move.product_uom.rounding
            if float_compare(move.quantity_done, move.product_uom_qty, precision_rounding=rounding) < 0:
                qty_to_do = float_round(
                    move.product_uom_qty - move.quantity_done,
                    precision_rounding=rounding,
                    rounding_method='HALF-UP')
                move._set_quantity_done(qty_to_do)
        pickings_to_do.with_context(skip_sms=True, cancel_backorder=True).button_validate()

    def write(self, vals):
        result = super().write(vals)
        if 'user_id' in vals:
            orders = self.filtered("is_fsm").sale_order_id.sudo().filtered(lambda order: order.state in ['draft', 'sent'])
            orders.write({'user_id': vals['user_id']})
        return result
