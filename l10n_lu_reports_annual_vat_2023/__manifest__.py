# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Luxembourg - Annual VAT Report 2023 update',
    'icon': '/l10n_lu/static/description/icon.png',
    'version': '1.0',
    'description': """
Annual VAT report for Luxembourg - 2023 update
===============================================
    """,
    'category': 'Accounting/Accounting',
    'depends': ['l10n_lu_reports_annual_vat'],
    'data': [
        'report/l10n_lu_annual_report.xml',
        'report/l10n_lu_annual_report_pdf_template.xml',
        'views/l10n_lu_yearly_tax_report_manual_views.xml',
    ],
    'license': 'OEEL-1',
    'auto_install': True,
}
