# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Employees in Gantt',
    'category': 'Hidden',
    'summary': 'Employees in Gantt',
    'version': '1.0',
    'description': """ """,
    'depends': ['hr', 'web_gantt'],
    'data': ['views/assets.xml'],
    'qweb': ['static/src/xml/hr_gantt.xml'],
    'auto_install': True,
    'license': 'OEEL-1',
}
