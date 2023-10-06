# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Spreadsheet CRM Templates",
    'version': '1.0',
    'category': 'Productivity/Documents',
    'summary': 'Spreadsheet CRM templates',
    'description': 'Spreadsheet CRM templates',
    'depends': ['documents_spreadsheet', 'crm'],
    'data': [
        'views/assets.xml',
        'data/documents_data.xml',
    ],
    'application': False,
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
