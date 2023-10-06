# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class StockInventoryLine(models.Model):
    _inherit = "stock.inventory.line"

    dummy_id = fields.Char(compute='_compute_dummy_id', inverse='_inverse_dummy_id')

    def _compute_dummy_id(self):
        self.dummy_id = ''

    def _inverse_dummy_id(self):
        pass


class StockInventory(models.Model):
    _inherit = 'stock.inventory'

    def action_client_action(self):
        """ Open the mobile view specialized in handling barcodes on mobile devices.
        """
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'stock_barcode_inventory_client_action',
            'target': 'fullscreen',
            'params': {
                'model': 'stock.inventory',
                'inventory_id': self.id,
            }
        }

    def get_barcode_view_state(self):
        """ Return the initial state of the barcode view as a dict.
        """
        if self.env.context.get('company_id'):
            company = self.env['res.company'].browse(self.env.context['company_id'])
        else:
            company = self.env.company
        inventories = self.read([
            'line_ids',
            'location_ids',
            'name',
            'state',
            'company_id',
        ])
        for inventory in inventories:
            inventory['line_ids'] = self.env['stock.inventory.line'].browse(inventory.pop('line_ids')).read([
                'product_id',
                'location_id',
                'product_qty',
                'theoretical_qty',
                'product_uom_id',
                'prod_lot_id',
                'package_id',
                'partner_id',
                'dummy_id',
            ])

            # Prefetch data
            location_ids = list(set([line_id["location_id"][0] for line_id in inventory['line_ids']]))
            product_ids = list(set([line_id["product_id"][0] for line_id in inventory['line_ids']]))

            parent_path_per_location_id = {}
            for res in self.env['stock.location'].search_read([('id', 'in', location_ids)], ['parent_path']):
                parent_path_per_location_id[res.pop("id")] = res

            tracking_and_barcode_per_product_id = {}
            for res in self.env['product.product'].with_context(active_test=False).search_read([('id', 'in', product_ids)], ['tracking', 'barcode']):
                tracking_and_barcode_per_product_id[res.pop("id")] = res

            for line_id in inventory['line_ids']:
                id, name = line_id.pop('product_id')
                line_id['product_id'] = {"id": id, "display_name": name, **tracking_and_barcode_per_product_id[id]}
                id, name = line_id.pop('location_id')
                line_id['location_id'] = {"id": id, "display_name": name, **parent_path_per_location_id[id]}
            inventory['location_ids'] = self.env['stock.location'].browse(inventory.pop('location_ids')).read([
                'id',
                'display_name',
                'parent_path',
            ])
            inventory['group_stock_multi_locations'] = self.env.user.has_group('stock.group_stock_multi_locations')
            inventory['group_tracking_owner'] = self.env.user.has_group('stock.group_tracking_owner')
            inventory['group_tracking_lot'] = self.env.user.has_group('stock.group_tracking_lot')
            inventory['group_production_lot'] = self.env.user.has_group('stock.group_production_lot')
            inventory['group_uom'] = self.env.user.has_group('uom.group_uom')
            inventory['group_barcode_keyboard_shortcuts'] = self.env.user.has_group('stock_barcode.group_barcode_keyboard_shortcuts')
            inventory['actionReportInventory'] = self.env.ref('stock.action_report_inventory').id
            if self.env.company.nomenclature_id:
                inventory['nomenclature_id'] = [self.env.company.nomenclature_id.id]
            if not inventory['location_ids'] and not inventory['line_ids']:
                warehouse = self.env['stock.warehouse'].search([('company_id', '=', self.env.company.id)], limit=1)
                inventory['location_ids'] = warehouse.lot_stock_id.read(['id', 'display_name', 'parent_path'])
        return inventories

    @api.model
    def open_new_inventory(self):
        action = self.env["ir.actions.actions"]._for_xml_id("stock_barcode.stock_barcode_inventory_client_action")
        company_user = self.env.company
        warehouses = self.env['stock.warehouse'].search([('company_id', '=', company_user.id)])
        if warehouses:
            default_location_ids = warehouses.mapped('lot_stock_id')
        else:
            raise UserError(_('You must define a warehouse for the company: %s.') % (company_user.name,))

        if self.env.ref('stock.warehouse0', raise_if_not_found=False):
            new_inv = self.env['stock.inventory'].create({
                'start_empty': True,
                'name': fields.Date.context_today(self),
                'location_ids': [(6, 0, default_location_ids.ids)],
            })
            new_inv.action_start()
            action['res_id'] = new_inv.id
            params = {
                'model': 'stock.inventory',
                'inventory_id': new_inv.id,
            }
            action['context'] = {'active_id': new_inv.id}
            action = dict(action, target='fullscreen', params=params)
        return action

    def action_open_inventory(self):
        self.ensure_one()
        view_id = self.env.ref('stock.view_inventory_form').id
        return {
            'name': _('Open Inventory form'),
            'res_model': 'stock.inventory',
            'view_mode': 'form',
            'view_id': view_id,
            'type': 'ir.actions.act_window',
            'res_id': self.id,
        }
