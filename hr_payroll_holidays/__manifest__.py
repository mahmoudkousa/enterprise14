# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Time Off in Payslips',
    'version': '1.0',
    'category': 'Human Resources/Payroll',
    'sequence': 95,
    'summary': '',
    'description': """
    """,
    'depends': ['hr_work_entry_holidays', 'hr_payroll'],
    'data': [
        'security/hr_payroll_holidays_security.xml',
    ],
    'auto_install': True,
    'license': 'OEEL-1',
}
