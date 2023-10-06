#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Payroll: Edit lines - Recompute work entries',
    'category': 'Human Resources/Employees',
    'sequence': 39,
    'summary': 'Allow payslip edition',
    'description': "",
    'depends': ['hr_payroll'],
    'data': [
        'data/hr_payroll_edit_lines_data.xml',
        'security/ir.model.access.csv',
        'views/assets.xml',
        'wizard/hr_work_entry_regeneration_wizard_views.xml',
        'wizard/hr_payroll_edit_payslip_lines_wizard_views.xml',
    ],
    'demo': [
    ],
    'auto_install': True,
    'license': 'OEEL-1',
}
