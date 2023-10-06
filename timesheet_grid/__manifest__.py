# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# YTI FIXME: This module should be named timesheet_enterprise
{
    'name': "Timesheets",
    'summary': "Track employee time on tasks",
    'description': """
* Timesheet submission and validation
* Activate grid view for timesheets
    """,
    'version': '1.0',
    'depends': ['web_grid', 'hr_timesheet', 'timer'],
    'category': 'Services/Timesheets',
    'sequence': 65,
    'data': [
        'data/mail_data.xml',
        'security/timesheet_security.xml',
        'security/ir.model.access.csv',
        'views/hr_timesheet_views.xml',
        'views/res_config_settings_views.xml',
        'views/assets.xml',
        'wizard/timesheet_merge_wizard_views.xml',
    ],
    'demo': [
        'data/timesheet_grid_demo.xml',
    ],
    'qweb': [
        'static/src/xml/timesheet_grid.xml',
        'static/src/xml/timer_m2o.xml',
    ],
    'website': ' https://www.odoo.com/page/timesheet-mobile-app',
    'auto_install': ['web_grid', 'hr_timesheet'],
    'application': True,
    'license': 'OEEL-1',
    'pre_init_hook': 'pre_init_hook',
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
}
