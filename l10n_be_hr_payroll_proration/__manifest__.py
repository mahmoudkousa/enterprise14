# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# YTI TODO: master: merge into l10n_be_hr_payroll
{
    'name': 'Belgian Payroll - Advantage Proration',
    'category': 'Human Resources',
    'summary': 'Advantage Proration',
    'depends': ['l10n_be_hr_payroll'],
    'description': """
    """,
    'data': [
        'data/cp200/employee_salary_data.xml',
        'data/cp200/work_entry_data.xml',
        'security/ir.model.access.csv',
        'views/hr_work_entry_views.xml',
    ],
    'qweb': [
    ],
    'demo': [],
    'auto_install': True,
    'license': 'OEEL-1',
}
