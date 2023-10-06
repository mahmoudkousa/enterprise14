from odoo import http, _
from odoo.http import request
from odoo.modules.module import get_resource_path
from odoo.tools import pdf


class StockBarcodeController(http.Controller):

    @http.route('/stock_barcode/scan_from_main_menu', type='json', auth='user')
    def main_menu(self, barcode, **kw):
        """ Receive a barcode scanned from the main menu and return the appropriate
            action (open an existing / new picking) or warning.
        """
        ret_open_picking = self.try_open_picking(barcode)
        if ret_open_picking:
            return ret_open_picking

        ret_open_picking_type = self.try_open_picking_type(barcode)
        if ret_open_picking_type:
            return ret_open_picking_type

        if request.env.user.has_group('stock.group_stock_multi_locations'):
            ret_new_internal_picking = self.try_new_internal_picking(barcode)
            if ret_new_internal_picking:
                return ret_new_internal_picking

        if request.env.user.has_group('stock.group_stock_multi_locations'):
            return {'warning': _('No picking or location corresponding to barcode %(barcode)s') % {'barcode': barcode}}
        else:
            return {'warning': _('No picking corresponding to barcode %(barcode)s') % {'barcode': barcode}}

    def try_open_picking_type(self, barcode):
        """ If barcode represent a picking type, open a new
        picking with this type
        """
        picking_type = request.env['stock.picking.type'].search([
            ('barcode', '=', barcode),
        ], limit=1)
        if picking_type:
            picking = request.env['stock.picking']._create_new_picking(picking_type)
            return self.get_action(picking.id)
        return False

    def try_open_picking(self, barcode):
        """ If barcode represents a picking, open it
        """
        corresponding_picking = request.env['stock.picking'].search([
            ('name', '=', barcode),
        ], limit=1)
        if corresponding_picking:
            return self.get_action(corresponding_picking.id)
        return False

    def try_new_internal_picking(self, barcode):
        """ If barcode represents a location, open a new picking from this location
        """
        corresponding_location = request.env['stock.location'].search([
            ('barcode', '=', barcode),
            ('usage', '=', 'internal')
        ], limit=1)
        if corresponding_location:
            internal_picking_type = request.env['stock.picking.type'].search([('code', '=', 'internal')])
            warehouse = corresponding_location.get_warehouse()
            if warehouse:
                internal_picking_type = internal_picking_type.filtered(lambda r: r.warehouse_id == warehouse)
            dest_loc = corresponding_location
            while dest_loc.location_id and dest_loc.location_id.usage == 'internal':
                dest_loc = dest_loc.location_id
            if internal_picking_type:
                # Create and confirm an internal picking
                picking = request.env['stock.picking'].create({
                    'picking_type_id': internal_picking_type[0].id,
                    'user_id': False,
                    'location_id': corresponding_location.id,
                    'location_dest_id': dest_loc.id,
                    'immediate_transfer': True,
                })
                picking.action_confirm()

                return self.get_action(picking.id)
            else:
                return {'warning': _('No internal operation type. Please configure one in warehouse settings.')}
        return False

    def get_action(self, picking_id):
        """
        return the action to display the picking. We choose between the traditionnal
        form view and the new client action
        """
        use_form_handler = request.env['ir.config_parameter'].sudo().get_param('stock_barcode.use_form_handler')
        if use_form_handler:
            view_id = request.env.ref('stock.view_picking_form').id
            return {
                'action': {
                    'name': _('Open picking form'),
                    'res_model': 'stock.picking',
                    'view_mode': 'form',
                    'view_id': view_id,
                    'views': [(view_id, 'form')],
                    'type': 'ir.actions.act_window',
                    'res_id': picking_id,
                }
            }
        else:
            return request.env['stock.picking']._get_client_action(picking_id)

    def _get_allowed_company_ids(self):
        """ Return the allowed_company_ids based on cookies.

        Currently request.env.company returns the current user's company when called within a controller
        rather than the selected company in the company switcher and request.env.companies lists the
        current user's allowed companies rather than the selected companies.

        :returns: List of active companies. The first company id in the returned list is the selected company.
        """
        cids = request.httprequest.cookies.get('cids', str(request.env.user.company_id.id))
        return [int(cid) for cid in cids.split(',')]

    @http.route('/stock_barcode/rid_of_message_demo_barcodes', type='json', auth='user')
    def rid_of_message_demo_barcodes(self, **kw):
        """ Edit the main_menu client action so that it doesn't display the 'print demo barcodes sheet' message """
        action = request.env.ref('stock_barcode.stock_barcode_action_main_menu')
        action and action.sudo().write({'params': {'message_demo_barcodes': False}})

    @http.route('/stock_barcode/get_set_barcode_view_state', type='json', auth='user')
    def get_set_barcode_view_state(self, model_name, record_id, mode, write_field=None, write_vals=None):
        if mode != 'read':
            request.env[model_name].browse(record_id).write({write_field: write_vals})
        return request.env[model_name].browse(record_id).with_context(company_id=self._get_allowed_company_ids()[0]).get_barcode_view_state()

    @http.route('/stock_barcode/print_inventory_commands', type='http', auth='user')
    def print_inventory_commands(self):
        if not request.env.user.has_group('stock.group_stock_user'):
            return request.not_found()

        barcode_pdfs = []

        # get fixed command barcodes
        file_path = get_resource_path('stock_barcode', 'static/img', 'barcodes_actions.pdf')
        commands_file = open(file_path, 'rb')
        barcode_pdfs.append(commands_file.read())
        commands_file.close()

        # make sure we use the selected company if possible
        allowed_company_ids = self._get_allowed_company_ids()

        # same domain conditions for picking types and locations
        domain = [('active', '=', 'True'),
                  ('barcode', '!=', ''),
                  ('company_id', 'in', allowed_company_ids)]

        # get picking types barcodes
        picking_type_ids = request.env['stock.picking.type'].search(domain, limit=200)
        picking_report = request.env.ref('stock.action_report_picking_type_label', raise_if_not_found=True)
        picking_types_pdf, _ = picking_report._render_qweb_pdf(picking_type_ids.ids)
        if picking_types_pdf:
            barcode_pdfs.append(picking_types_pdf)

        # get locations barcodes
        if request.env.user.has_group('stock.group_stock_multi_locations'):
            locations_ids = request.env['stock.location'].search(domain, limit=200)
            locations_report = request.env.ref('stock.action_report_location_barcode', raise_if_not_found=True)
            locations_pdf, _ = locations_report._render_qweb_pdf(locations_ids.ids)
            if locations_pdf:
                barcode_pdfs.append(locations_pdf)

        merged_pdf = pdf.merge_pdf(barcode_pdfs)

        pdfhttpheaders = [
            ('Content-Type', 'application/pdf'),
            ('Content-Length', len(merged_pdf))
        ]

        return request.make_response(merged_pdf, headers=pdfhttpheaders)
