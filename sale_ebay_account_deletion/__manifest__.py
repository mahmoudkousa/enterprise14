# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
  'name': "eBay Connector - Account Deletion",
  'version': '1.0',
  'summary': """eBay: support customer account deletion requests""",
  'description': """
Following recent requirements from eBay, this module provides
a route to receive eBay Marketplace Account Deletion/Closure Notifications.

It also explains in the Settings how to setup this webhook according to eBay
requirements.
  """,
  'license': 'OEEL-1',
  'category': 'Sales',
  'depends': ['sale_ebay'],
  'data': [
      'data/mail_data.xml',
      'views/res_config_settings_views.xml',
  ],
  'auto_install': True,
  'application': False,
  'installable': True,
}
