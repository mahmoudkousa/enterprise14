# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "VOIP",

    'summary': """
        Make calls using a VOIP system""",

    'description': """
Allows to make call from next activities or with click-to-dial.
    """,

    'category': 'Productivity/VOIP',
    'sequence': 280,
    'version': '2.0',

    # any module necessary for this one to work correctly
    'depends': ['base', 'mail', 'web', 'phone_validation', 'web_mobile'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/res_partner_views.xml',
        'views/res_users_views.xml',
        'views/voip_phonecall_views.xml',
        'views/voip_templates.xml',
        'data/mail_activity_data.xml',
    ],
    'qweb': [
        'static/src/bugfix/bugfix.xml',
        'static/src/components/activity/activity.xml',
        'static/src/xml/*.xml',
    ],
    'application': True,
    'license': 'OEEL-1',
}
