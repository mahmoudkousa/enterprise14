#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Work Entries - Contract',
    'category': 'Human Resources/Employees',
    'sequence': 39,
    'summary': 'Manage work entries',
    'description': "",
    'installable': True,
    'depends': [
        'hr_work_entry',
        'hr_contract',
    ],
    'data': [
        'security/hr_work_entry_security.xml',
        'data/hr_work_entry_data.xml',
        'views/hr_work_entry_template.xml',
        'views/hr_work_entry_views.xml',
        'views/hr_payroll_menu.xml',
    ],
    'demo': [
        'data/hr_work_entry_demo.xml',
    ],

    'license': 'OEEL-1',
}
