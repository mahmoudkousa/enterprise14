# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Subcontract with Barcode",
    'summary': "Allows the subcontracting process with the barcode views",
    'category': 'Hidden',
    'version': '1.0',
    'description': """
        This bridge module is auto-installed when the modules stock_barcode and mrp_subcontracting are installed.
    """,
    'depends': ['stock_barcode', 'mrp_subcontracting'],
    'data': [
        'views/stock_barcode_templates.xml',
    ],
    'qweb': [
        "static/src/xml/qweb_templates.xml",
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
