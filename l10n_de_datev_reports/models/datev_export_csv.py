# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class DatevExportCSV(models.AbstractModel):
    _inherit = 'account.general.ledger'

    def _get_account_length(self):
        # OVERRIDE
        # We have a company setting for this in this module
        return self.env.company.l10n_de_datev_account_length

    def _get_account_identifier(self, account, partner):
        # OVERRIDE
        """
        We have to override to take into account the second DateV identifier
        """
        len_param = self._get_account_length() + 1
        if account.internal_type == 'receivable':
            # for customers
            return partner.l10n_de_datev_identifier_customer or int('1'.ljust(len_param, '0')) + partner.id
        else:
            # for vendors
            return partner.l10n_de_datev_identifier or int('7'.ljust(len_param, '0')) + partner.id
