# -*- coding: utf-8 -*-
{
    'name': "Online Bank Statement Synchronization",
    'summary': """
This module is used for Online bank synchronization.""",

    'description': """
With this module, users will be able to link bank journals to their
online bank accounts (for supported banking institutions), and configure
a periodic and automatic synchronization of their bank statements.
This module has been added end of 2020 and is purpose is to work with
the latest providers. It should be used over the previous account_online_sync
module.
    """,

    'category': 'Accounting/Accounting',
    'version': '1.0',
    'depends': ['account_online_sync'],

    'data': [
        'views/account_asset.xml',
        'data/config_parameter.xml',
        'security/ir.model.access.csv',
        'security/account_online_sync_security.xml',
        'views/account_online_sync.xml',
        'wizard/account_link_journal_wizard.xml',
        'views/migrate_views.xml',
    ],
    'license': 'OEEL-1',
    'auto_install': True,
    'post_init_hook': '_post_install_hook_convert_old_sync',
}
