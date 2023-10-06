# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Field Service - Sale",
    'summary': "Schedule and track onsite operations, invoice time and material",
    'description': """
Create Sales order with timesheets and products from tasks
    """,
    'category': 'Services/Field Service',
    'version': '1.0',
    'depends': ['industry_fsm', 'sale_timesheet_enterprise'],
    'qweb': [
        "static/src/xml/fsm_quantity.xml"
    ],
    'data': [
        'data/industry_fsm_data.xml',
        'security/industry_fsm_sale_security.xml',
        'views/assets.xml',
        'views/project_task_views.xml',
        'views/product_product_views.xml',
        'views/project_project_views.xml',
        'views/res_config_settings_views.xml',
        'views/sale_order_views.xml',
    ],
    'application': False,
    'auto_install': True,
    'demo': [],
    'post_init_hook': 'post_init',
    'license': 'OEEL-1',
}
