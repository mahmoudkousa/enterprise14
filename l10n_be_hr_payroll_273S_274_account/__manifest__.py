# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Belgian Payroll - Withholding Taxes Exemption',
    'category': 'Human Resources',
    'summary': 'Withholding Taxes Exemption',
    'depends': ['l10n_be_hr_payroll_account', 'l10n_be_hr_payroll_273S_274'],
    'description': """
    """,
    'data': [
        'wizard/l10n_be_hr_payroll_274_XX_wizard_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'qweb': [],
    'demo': [],
    'auto_install': True,
    'license': 'OEEL-1',
}
