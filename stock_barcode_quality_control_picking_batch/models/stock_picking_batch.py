# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class StockPickingBatch(models.Model):
    _inherit = 'stock.picking.batch'

    @api.model
    def _get_fields_to_read(self):
        """ Inject the field 'quality_check_todo' in the initial state of the barcode view.
        """
        fields = super()._get_fields_to_read()
        fields.append('quality_check_todo')
        return fields
