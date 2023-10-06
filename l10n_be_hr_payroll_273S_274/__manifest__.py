# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Belgian Payroll - 273S / 274.XX Sheets',
    'category': 'Human Resources',
    'summary': 'Withholding Taxes Exports for FINPROF',
    'depends': ['l10n_be_hr_payroll'],
    'description': """
    """,
    'data': [
        'views/hr_contract_views.xml',
        'wizard/l10n_be_hr_payroll_273S_wizard_views.xml',
        'wizard/l10n_be_hr_payroll_274_XX_wizard_views.xml',
        'security/ir.model.access.csv',
        'report/l10n_be_hr_payroll_274_XX_sheet_template.xml',
        'report/l10n_be_hr_payroll_273S_pdf_template.xml',
        'views/reports.xml',
        'views/withholding_tax_xml_export_template.xml',
        'views/273S_xml_export_template.xml',
        'views/res_config_settings_views.xml',
    ],
    'qweb': [],
    'demo': [
        'data/l10n_be_hr_payroll_demo.xml',
    ],
    'auto_install': True,
    'license': 'OEEL-1',
}
