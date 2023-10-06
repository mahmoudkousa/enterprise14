# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Belgian Payroll - Impulsion Plans',
    'category': 'Human Resources',
    'summary': 'Impulsion Plans (Forem)',
    'depends': ['l10n_be_hr_payroll'],
    'description': """
    """,
    'data': [
        'views/hr_contract_views.xml',
        'data/cp200/employee_salary_data.xml',
    ],
    'qweb': [],
    'demo': [],
    'auto_install': True,
    'license': 'OEEL-1',
}
