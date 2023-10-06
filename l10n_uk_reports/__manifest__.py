# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Copyright (C) 2011 Smartmode LTD (<http://www.smartmode.co.uk>).

{
    'name': 'UK - Accounting Reports',
    'version': '1.1',
    'category': 'Accounting/Localizations/Reporting',
    'description': """
        Accounting reports for UK

        Allows to send the tax report via the
        MTD-VAT API to HMRC.
    """,
    'author': 'SmartMode LTD',
    'website': 'https://www.odoo.com/page/accounting',
    'depends': [
        'l10n_uk', 'account_reports'
    ],
    'data': [
        'views/views.xml',
        "views/res_users_views.xml",
        "views/l10n_uk_reports.xml",
        'security/ir.model.access.csv',
        'security/hmrc_security.xml',
        'wizard/hmrc_send_wizard.xml',
    ],
    'qweb': [
        "static/src/xml/send_hmrc.xml",
    ],
    'installable': True,
    'auto_install': True,
    'license': 'OEEL-1',
}
