# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Push notification to track listeners',
    'category': 'Marketing/Events',
    'sequence': 1021,
    'version': '1.0',
    'summary': 'Send reminder push notifications to event attendees based on wishlisted tracks.',
    'website': 'https://www.odoo.com/page/events',
    'description': "",
    'depends': [
        'website_event_social',
        'website_event_track',
    ],
    'data': [
        'views/event_event_views.xml',
        'views/event_track_views.xml'
    ],
    'demo': [
    ],
    'application': False,
    'installable': True,
    'auto_install': True,
    'post_init_hook': 'post_init',
    'license': 'OEEL-1',
}
