# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Planning",
    'summary': """Manage your employees' schedule""",
    'description': """
    Schedule your teams and employees with shift.
    """,
    'category': 'Human Resources/Planning',
    'sequence': 130,
    'version': '1.0',
    'depends': ['hr', 'web_gantt', 'digest', 'hr_gantt'],
    'data': [
        'security/planning_security.xml',
        'security/ir.model.access.csv',
        'data/digest_data.xml',
        'wizard/planning_send_views.xml',
        'wizard/slot_planning_select_send_views.xml',
        'views/assets.xml',
        'views/hr_views.xml',
        'views/planning_template_views.xml',
        'views/planning_views.xml',
        'views/planning_report_views.xml',
        'views/res_config_settings_views.xml',
        'views/planning_templates.xml',
        'data/planning_cron.xml',
        'data/mail_data.xml',
    ],
    'demo': [
        'data/planning_demo.xml',
    ],
    'application': True,
    'license': 'OEEL-1',
    'qweb': [
        'static/src/xml/planning_gantt.xml',
    ]
}
