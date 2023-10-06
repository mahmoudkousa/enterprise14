# -*- coding: utf-8 -*-

from odoo import api, models, fields, _

from odoo.exceptions import UserError, RedirectWarning

class ResCompany(models.Model):
    _inherit = "res.company"

    @api.model
    def setting_init_bank_account_action(self):
        """ Setup bar function, overridden to call the online synchronization wizard
        allowing to setup bank account instead of the default wizard used in community.
        If no bank journal exists yet, we trigger an error message asking to install
        a CoA, which will create the journal."""
        company = self.env.company

        bank_journal = self.env['account.journal'].search([('company_id','=', company.id), ('type','=','bank'), ('bank_account_id', '=', False)], limit=1)
        if not bank_journal:
            bank_journal = self.env['account.journal'].search([('company_id','=', company.id), ('type','=','bank')], limit=1)

        if not bank_journal:
            any_journal = self.env['account.journal'].search([('company_id', '=', company.id)], limit=1)
            if not any_journal:
                action = self.env.ref('account.action_account_config')
                raise RedirectWarning(_('You should install a fiscal localization first.'), action.id,  _('Accounting Settings'))
            raise UserError(_('It looks like a bank account is missing.'))

        return bank_journal.action_choose_institution()
