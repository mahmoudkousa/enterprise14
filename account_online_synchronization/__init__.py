# -*- coding: utf-8 -*-

from . import models
from . import wizard

from odoo import api, SUPERUSER_ID, _

def _post_install_hook_convert_old_sync(cr, registry):
    """
    This method is executed after the installation of this module.
    Its purpose is to transform all objects "account_online_provider"
    and "account_online_journal" into "account_online_link" and
    "account_online_account". All the new "account_online_link"
    are just present to ensure the transition. They are not usable
    with the Odoo Fin proxy.
    """
    env = api.Environment(cr, SUPERUSER_ID, {})
    # Get journal linked to account_online_journal
    journals_containing_synchronization = env['account.journal'].search([('account_online_journal_id', '!=', False)])
    if journals_containing_synchronization:
        old_online_providers = journals_containing_synchronization.mapped('account_online_provider_id')
        new_records = []
        for old_provider in old_online_providers:
            # Create new online accounts (ignore the accounts that were not linked to a journal)
            account_online_accounts = [
                (0, 0, 
                    {
                        'name': acc.name,
                        'balance': acc.balance,
                        'account_number': acc.account_number,
                        'account_data': '',
                        'journal_ids': [(6, 0, acc.journal_ids[0].ids)],
                        'last_sync': acc.last_sync
                    }
                ) 
                for acc in old_provider.account_online_journal_ids if acc.journal_ids
            ]
            # Create the link containing the accounts
            account_online_link = {
                'name': _('To delete: %s', old_provider.name),
                'client_id': 'old_record_to_delete',
                'provider_data': '', 
                'company_id': old_provider.company_id.id,
                'last_refresh': old_provider.last_refresh,
                'next_refresh': old_provider.next_refresh,
                'state': 'disconnected',
                'auto_sync': False,
                'account_online_account_ids': account_online_accounts
            }
            new_records.append(account_online_link)
        # Create the records
        new_online_links = env['account.online.link'].create(new_records)
        for link in new_online_links:
            link.message_post(body=_("This link comes from a previous version of bank synchronization and will " 
                "not work anymore. Please delete this record and create a new link with your bank."))

    # Cleanup of old entries
    env['account.online.provider'].search([]).unlink()
