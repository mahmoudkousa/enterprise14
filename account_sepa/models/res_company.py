# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from .account_batch_payment import check_valid_SEPA_str
from .account_journal import sanitize_communication

class ResCompany(models.Model):
    _inherit = "res.company"

    # TODO : complete methods _default_sepa_origid_id and _default_sepa_origid_issr for all countries of the SEPA

    sepa_orgid_id = fields.Char('Identification', size=35, copy=False, compute='_compute_sepa_origid', readonly=False, store=True,
        help="Identification assigned by an institution (eg. VAT number).")
    sepa_orgid_issr = fields.Char('Issuer', size=35, copy=False, compute='_compute_sepa_origid', readonly=False, store=True,
        help="Entity that assigns the identification (eg. KBE-BCO or Finanzamt Muenchen IV).")
    sepa_initiating_party_name = fields.Char('Your Company Name', size=70, copy=False,
        help="Will appear in SEPA payments as the name of the party initiating the payment. Limited to 70 characters.")
    sepa_pain_version = fields.Selection(
        [
            ('pain.001.001.03', 'Generic'),
            ('pain.001.001.03.ch.02', 'Swiss Version'),
            ('pain.001.003.03', 'German Version'),
            ('pain.001.001.03.se', 'Sweden Version'),
            ('pain.001.001.03.austrian.004', 'Austrian Version')
        ],
        string='SEPA Pain Version',
        required=True,
        default='pain.001.001.03',
        compute='_compute_sepa_pain_version',
        help='SEPA may be a generic format, some countries differ from the SEPA recommandations made by the EPC (European Payment Councile) and thus the XML created need some tweakenings.'
    )

    @api.model
    def create(self, vals):
        # Overridden in order to set the name of the company as default value
        # for sepa_initiating_party_name field
        name = vals.get('name')
        if name and 'sepa_initiating_party_name' not in vals:
            vals['sepa_initiating_party_name'] = sanitize_communication(name)

        return super(ResCompany, self).create(vals)

    @api.depends('partner_id.country_id')
    def _compute_sepa_origid(self):
        """ Set default value for :
            - sepa_orgid_issr, which correspond to the field 'Issuer' of an 'OrganisationIdentification', as described in ISO 20022.
            - sepa_orgid_id, which correspond to the field 'Identification' of an 'OrganisationIdentification', as described in ISO 20022.
        """
        for company in self:
            if company.partner_id.country_id.code == 'BE':
                company.sepa_orgid_issr = 'KBO-BCE'
                company.sepa_orgid_id = company.vat[:2].upper() + company.vat[2:].replace(' ', '') if company.vat else ''
            else:
                company.sepa_orgid_issr = ''
                company.sepa_orgid_id = ''

    @api.depends('country_id')
    def _compute_sepa_pain_version(self):
        """ Set default value for the field sepa_pain_version"""
        pains_by_country = {
            'DE': 'pain.001.003.03',
            'CH': 'pain.001.001.03.ch.02',
            'SE': 'pain.001.001.03.se',
            'AT': 'pain.001.001.03.austrian.004',
        }
        for company in self:
            forced_value = self.env['ir.config_parameter'].sudo().get_param(f'account_sepa.forced_pain_version_{company.id}')
            if forced_value:
                company.sepa_pain_version = forced_value
            else:
                company.sepa_pain_version = pains_by_country.get(company.country_id.code, 'pain.001.001.03')

    @api.constrains('sepa_orgid_id', 'sepa_orgid_issr', 'sepa_initiating_party_name')
    def _check_sepa_fields(self):
        for rec in self:
            if rec.sepa_orgid_id:
                check_valid_SEPA_str(rec.sepa_orgid_id)
            if rec.sepa_orgid_issr:
                check_valid_SEPA_str(rec.sepa_orgid_issr)
            if rec.sepa_initiating_party_name:
                check_valid_SEPA_str(rec.sepa_initiating_party_name)
