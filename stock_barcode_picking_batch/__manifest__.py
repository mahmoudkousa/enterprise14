# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Barcode for Batch Transfer',
    'version': '1.0',
    'category': 'Inventory/Inventory',
    'summary': "Add the support of batch transfers into the barcode view",
    'description': "",
    'depends': ['stock_barcode', 'stock_picking_batch'],
    'data': [
        'views/stock_barcode_picking_batch.xml',
        'views/stock_barcode_picking_batch_templates.xml',
        'views/stock_move_line_views.xml',
        'views/stock_quant_package_views.xml',
        'data/data.xml',
    ],
    'demo': [
        'data/stock_barcode_picking_batch_demo.xml',
    ],
    'qweb': [
        'static/src/xml/qweb_templates.xml',
        'static/src/xml/stock_barcode.xml',
    ],
    'application': False,
    'auto_install': True,
    'license': 'OEEL-1',
}
