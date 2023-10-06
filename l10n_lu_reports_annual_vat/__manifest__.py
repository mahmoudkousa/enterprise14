# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Luxembourg - Annual VAT Report',
    'icon': '/l10n_lu/static/description/icon.png',
    'version': '1.0',
    'description': """
Annual VAT report for Luxembourg
============================================
    """,
    'category': 'Accounting/Accounting',
    'depends': ['l10n_lu_reports_electronic_xml_2_0'],
    'data': [
        'views/assets.xml',
        'views/l10n_lu_yearly_tax_report_manual_views.xml',
        'security/ir.model.access.csv',
        'security/l10n_lu_yearly_tax_report_manual_security.xml',
    ],
    'license': 'OEEL-1',
    'auto_install': True,
    'post_init_hook': '_post_init_hook',
}
