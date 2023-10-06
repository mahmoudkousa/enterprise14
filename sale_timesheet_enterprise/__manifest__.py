# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Sales Timesheet: Invoicing",

    'summary': "Configure timesheet invoicing",

    'description': """
        When invoicing timesheets, allows invoicing either all timesheets
        linked to an SO, or only the validated timesheets
    """,

    'category': 'Hidden',
    'version': '0.1',

    'depends': ['sale_timesheet', 'timesheet_grid'],
    'data': [
        'views/hr_timesheet_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'demo': [
        'data/sale_timesheet_enterprise_demo.xml'
    ],
    'auto_install': True,
    'license': 'OEEL-1',
}
