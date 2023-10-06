# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Barcode in Mobile',
    'category': 'Human Resources/Barcode',
    'summary': 'POS Barcode scan in Mobile',
    'version': '1.0',
    'description': """ """,
    'depends': ['pos_hr', 'web_mobile'],
    'data': ['views/pos_barcode_mobile_template.xml'],
    'qweb': [
        'static/src/xml/pos_barcode_mobile.xml',
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
