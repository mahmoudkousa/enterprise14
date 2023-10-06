# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# YTI TODO: master: merge into l10n_be_hr_payroll
{
    'name': 'Belgian Payroll - Variable Revenue',
    'category': 'Human Resources',
    'summary': 'Variable Revenue',
    'depends': ['l10n_be_hr_payroll_account'],
    'description': """
    """,
    'data': [
        'wizard/hr_payroll_payslips_by_employees_views.xml',
        'wizard/hr_payroll_generate_commission_payslips_views.xml',
        'views/assets.xml',
        'views/hr_payslip_run_views.xml',
        'data/cp200/employee_commission_on_target_data.xml',
        'security/ir.model.access.csv',
        'data/work_entry_type_data.xml',
    ],
    'qweb': [
        'static/src/xml/payslip_batch_tree_view.xml',
        'static/src/xml/generate_commission_payslips_form_view.xml',
    ],
    'demo': [],
    'auto_install': True,
    'license': 'OEEL-1',
}
