# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# YTI TODO: master: merge fields into l10n_be_hr_payroll
#                   merge wizard into hr_work_entry_contract
#  + Add tests in test_l10n_be_hr_payroll_account (no stable dependency)
{
    'name': 'Belgian Payroll - Posted Employee',
    'category': 'Human Resources',
    'summary': 'Posted Employee',
    'depends': ['l10n_be_hr_payroll'],
    'description': """
    """,
    'data': [
        'data/salary_rules_data.xml',
        'wizard/create_company_global_time_off_views.xml',
        'views/hr_contract_views.xml',
        'views/resource_calendar_views.xml',
        'security/ir.model.access.csv',
    ],
    'qweb': [],
    'demo': [],
    'auto_install': True,
    'license': 'OEEL-1',
}
