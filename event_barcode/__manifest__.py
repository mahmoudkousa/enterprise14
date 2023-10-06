# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Event Barcode Scanning",
    'summary': "Add barcode scanning feature to event management.",
    'version': '1.0',
    'description': """
This module adds support for barcodes scanning to the Event management system.
A barcode is generated for each attendee and printed on the badge. When scanned,
the registration is confirmed.
    """,
    'category': 'Marketing/Events',
    'depends': ['barcodes', 'event'],
    'data': [
        'views/assets.xml',
        'views/event_event_views.xml',
        'views/event_registration_views.xml',
        'views/event_report_templates.xml',
        'views/res_config_settings_views.xml',
    ],
    'qweb': [
        "static/src/xml/event_barcode.xml",
    ],
    'license': 'OEEL-1',
}
