# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from operator import itemgetter

from odoo import api, fields, models, _


class StockPickingBatch(models.Model):
    _inherit = 'stock.picking.batch'

    picking_type_code = fields.Selection(related='picking_type_id.code')

    def action_client_action(self):
        """ Open the mobile view specialized in handling barcodes on mobile devices.
        """
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'stock_barcode_picking_batch_client_action',
            'target': 'fullscreen',
            'params': {
                'model': 'stock.picking.batch',
                'picking_batch_id': self.id,
            }
        }

    def action_open_batch_picking(self):
        """ Method to open the form view of the current record from a button on the kanban view.
        """
        self.ensure_one()
        view_id = self.env.ref('stock_picking_batch.stock_picking_batch_form').id
        return {
            'name': _('Open picking batch form'),
            'res_model': 'stock.picking.batch',
            'view_mode': 'form',
            'view_id': view_id,
            'type': 'ir.actions.act_window',
            'res_id': self.id,
        }

    @api.model
    def open_new_batch_picking(self):
        """ Creates a new batch picking and opens client action to select its pickings.

        :return: the action used to select pickings for the new batch picking
        :rtype: dict
        """
        picking_batch = self.env['stock.picking.batch'].create({})
        action = self.env['ir.actions.client']._for_xml_id('stock_barcode_picking_batch.stock_barcode_picking_batch_create_client_action')
        action = dict(action, target='fullscreen', context={'active_id': picking_batch.id})
        action = {'action': action}
        return action

    @api.model
    def action_get_new_batch_status(self, picking_batch_id):
        """ Return the initial state of a new batch picking as a dict. """
        picking_batch = self.env['stock.picking.batch'].browse(picking_batch_id)
        picking_states = dict(self.env['stock.picking'].fields_get(['state'])['state']['selection'])
        allowed_picking_ids = picking_batch.allowed_picking_ids.filtered(lambda p: p.state == 'assigned')
        allowed_picking_types = sorted(allowed_picking_ids.mapped('picking_type_id').read(['name']), key=itemgetter('name'))
        allowed_picking_ids = sorted(allowed_picking_ids.read(['name', 'user_id', 'state', 'picking_type_id']), key=itemgetter('name'))
        # convert to selection label
        for picking in allowed_picking_ids:
            picking["state"] = picking_states[picking["state"]]

        return {
            'picking_batch_name': picking_batch.name,
            'allowed_picking_ids': allowed_picking_ids,
            'allowed_picking_types': allowed_picking_types,
        }

    @api.model
    def action_confirm_batch_picking(self, picking_batch_id, picking_ids=None):
        """ Confirms selected pickings for a batch picking.

        Errors are expected to be handled in parent class and automatically stops batch confirmation
        and pickings.write(...). If picking_ids=None or picking_ids.types not the same => expect UserError.

        :params picking_batch_id: newly created batch
        :params picking_ids: pickings ids to add to new batch
        :return: boolean if successful
        """
        if picking_ids:
            pickings = self.env['stock.picking'].browse(picking_ids)
            pickings.write({'batch_id': picking_batch_id})
        picking_batch = self.env['stock.picking.batch'].browse(picking_batch_id)
        return picking_batch.action_confirm()

    def _define_picking_colors(self):
        """ Defines a color hue for each picking. These values will be used to
        color picking batch lines in barcode app.

        :return: a dict where the picking id is the key and the color is the value.
        :rtype: dict
        """
        count = 0
        colors = {}
        if self.picking_ids:
            # The hue goes from 0 to 360 as it works this way in CSS.
            hue_shift = 360 / len(self.picking_ids)
            for picking in self.picking_ids:
                colors[picking.id] = count * hue_shift
                count += 1
        return colors

    def get_barcode_view_state(self):
        """ Return the initial state of the barcode view as a dict.
        """
        if self.env.context.get('company_id'):
            company = self.env['res.company'].browse(self.env.context['company_id'])
        else:
            company = self.env.company
        picking_colors = self._define_picking_colors()
        fields_to_read = self._get_fields_to_read()
        batch_pickings = self.read(fields_to_read)
        source_location_list, destination_location_list = self.picking_ids._get_locations()
        for batch_picking in batch_pickings:
            pickings = self.env['stock.picking'].browse(batch_picking.pop('picking_ids'))
            batch_picking['picking_ids'] = pickings.get_barcode_view_state()
            if batch_picking['picking_ids']:
                batch_picking['location_id'] = batch_picking['picking_ids'][0]['location_id']
                batch_picking['location_dest_id'] = batch_picking['picking_ids'][0]['location_dest_id']

            # Get the move lines from the pickings...
            batch_picking['move_line_ids'] = []
            for picking in batch_picking['picking_ids']:
                for move_line in picking['move_line_ids']:
                    # Writes manually used picking fields instead of put
                    # directly picking dict to avoid circular reference.
                    move_line['picking_id'] = {
                        'id': picking['id'],
                        'name': picking['name'],
                    }
                    move_line['color_hue'] = picking_colors[picking['id']]
                    batch_picking['move_line_ids'].append(move_line)

            batch_picking['group_stock_multi_locations'] = self.env.user.has_group('stock.group_stock_multi_locations')
            batch_picking['group_tracking_owner'] = self.env.user.has_group('stock.group_tracking_owner')
            batch_picking['group_tracking_lot'] = self.env.user.has_group('stock.group_tracking_lot')
            if batch_picking['group_tracking_lot']:
                batch_picking['usable_packages'] = self.env['stock.quant.package'].get_usable_packages_by_barcode()
            batch_picking['group_production_lot'] = self.env.user.has_group('stock.group_production_lot')
            batch_picking['group_uom'] = self.env.user.has_group('uom.group_uom')
            if batch_picking['picking_type_id']:
                batch_picking['use_create_lots'] = self.env['stock.picking.type'].browse(batch_picking['picking_type_id'][0]).use_create_lots
                batch_picking['use_existing_lots'] = self.env['stock.picking.type'].browse(batch_picking['picking_type_id'][0]).use_existing_lots
            batch_picking['source_location_list'] = source_location_list
            batch_picking['destination_location_list'] = destination_location_list
        return batch_pickings

    @api.model
    def _get_fields_to_read(self):
        return [
            'company_id',
            'move_line_ids',
            'name',
            'picking_ids',
            'picking_type_id',
            'picking_type_code',
            'state',
        ]
