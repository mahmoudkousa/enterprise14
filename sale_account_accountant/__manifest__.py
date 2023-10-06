# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Sale Accounting",
    'version': "1.0",
    'category': "Sales/Sales",
    'summary': "Bridge between Sale and Accounting",
    'description': """
Notify that a matching sale order exists in the reconciliation widget.
    """,
    'depends': ['sale', 'account_accountant'],
    'data': [
        'views/sale_account_accountant_templates.xml',
    ],
    'demo': [
    ],
    'qweb': [
        "static/src/xml/account_reconciliation.xml",
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
    'license': 'OEEL-1',
}
