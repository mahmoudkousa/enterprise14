# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Data Cleaning (merge)',
    'version': '1.1',
    'category': 'Productivity/Data Cleaning',
    'summary': 'Find duplicate records and merge them',
    'description': """Find duplicate records and merge them""",
    'depends': ['mail', 'data_cleaning'],
    'data': [
        'security/ir.model.access.csv',
        'security/security.xml',
        'views/data_merge_rule_views.xml',
        'views/data_merge_model_views.xml',
        'views/data_merge_record_views.xml',
        'views/data_merge_views.xml',
        'views/data_merge_templates.xml',
        'data/data_merge_cron.xml',
        'data/data_merge_data.xml',
    ],
    'qweb': [
        'static/src/xml/data_merge_list_views.xml',
    ],
    'auto_install': True,
    'installable': True,
    'application': False,
    'post_init_hook': 'post_init',
    'license': 'OEEL-1',
}
