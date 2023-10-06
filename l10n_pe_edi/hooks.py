# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import SUPERUSER_ID, api

def post_init_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    pe_companies = env['res.company'].search([('partner_id.country_id.code', '=', 'PE')])
    pe_journals = env['account.journal'].search([('company_id', 'in', pe_companies.ids), ('type', '=', 'sale')])
    for pe_journal in pe_journals:
        if not env['account.move'].search([('posted_before', '=', True), ('journal_id', '=', pe_journal.id)], limit=1):
            pe_journal.l10n_latam_use_documents = True
