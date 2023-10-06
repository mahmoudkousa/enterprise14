# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Social Demo Module',
    'category': 'Hidden',
    'summary': 'Get demo data for the social module',
    'version': '1.0',
    'description': """Get demo data for the social module.
    This module creates a social 'sandbox' where you can play around with the social app without publishing anything on actual social media.""",
    'depends': ['social', 'social_facebook', 'social_twitter', 'social_linkedin', 'product'],
    'data': [
        'views/assets.xml'
    ],
    'demo': [
        'data/social_demo.xml',
    ],
    'license': 'OEEL-1',
}
