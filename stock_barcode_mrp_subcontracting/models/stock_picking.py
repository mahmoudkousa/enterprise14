#  -*- coding: utf-8 -*-
#  Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    def _get_picking_fields_to_read(self):
        """ Inject the field 'display_action_record_components' in the initial
        state of the barcode view.
        """
        fields = super(StockPicking, self)._get_picking_fields_to_read()
        fields.append('display_action_record_components')
        return fields

    @api.model
    def _get_move_line_ids_fields_to_read(self):
        fields = super()._get_move_line_ids_fields_to_read()
        fields.append('move_id')
        return fields

    def get_barcode_view_state(self):
        pickings = super(StockPicking, self).get_barcode_view_state()
        for picking in pickings:
            for move_line_id in picking['move_line_ids']:
                move_id = move_line_id.get('move_id')
                if not move_id:
                    move_line_id['is_subcontract'] = False
                    continue
                move = self.env['stock.move'].browse(move_id[0])
                move_line_id['is_subcontract'] = move.read([
                    'is_subcontract',
                ])[0]['is_subcontract']
                if move_line_id['is_subcontract']:
                    move_line_id['move_id'] = move_id
                    move_line_id['is_subcontract'] = move._has_tracked_subcontract_components()
        return pickings
