# coding: utf-8
from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_co_edi_large_taxpayer = fields.Boolean(string='Gran Contribuyente')

    l10n_co_edi_representation_type_id = fields.Many2one('l10n_co_edi.type_code', string='Tipo de Representación', domain=[('type', '=', 'representation')])
    l10n_co_edi_establishment_type_id = fields.Many2one('l10n_co_edi.type_code', string='Tipo Establecimiento', domain=[('type', '=', 'establishment')])

    l10n_co_edi_obligation_type_ids = fields.Many2many('l10n_co_edi.type_code',
                                                       'partner_l10n_co_edi_obligation_types',
                                                       'partner_id', 'type_id',
                                                       string='Obligaciones y Responsabilidades',
                                                       domain=[('type', '=', 'obligation')])
    l10n_co_edi_customs_type_ids = fields.Many2many('l10n_co_edi.type_code',
                                                    'partner_l10n_co_edi_customs_types',
                                                    'partner_id', 'type_id',
                                                    string='Usuario Aduanero',
                                                    domain=[('type', '=', 'customs')])
    l10n_co_edi_simplified_regimen = fields.Boolean('Simplified Regimen')
    l10n_co_edi_fiscal_regimen = fields.Selection([
        ('48', 'IVA'),
        ('49', 'No Aplica'),
        ('04', 'IC'),
        ('ZA', 'IVA en IC'),
    ], string="Fiscal Regimen", required=True, default='48')
    l10n_co_edi_commercial_name = fields.Char('Commercial Name')

    def _get_vat_without_verification_code(self):
        self.ensure_one()
        # last digit is the verification code
        # last digit is the verification code, but it could have a - before
        if self.l10n_latam_identification_type_id.l10n_co_document_code != 'rut' or self.vat == '222222222222':
            return self.vat
        elif self.vat and "-" in self.vat:
            return self.vat.split('-')[0]
        return self.vat[:-1] if self.vat else ''

    def _get_vat_verification_code(self):
        self.ensure_one()
        if self.l10n_latam_identification_type_id.l10n_co_document_code != 'rut':
            return ''
        elif self.vat and "-" in self.vat:
            return self.vat.split('-')[1]
        return self.vat[-1] if self.vat else ''

    def _l10n_co_edi_get_fiscal_values(self):
        return self.l10n_co_edi_obligation_type_ids | self.l10n_co_edi_customs_type_ids

    def _l10n_co_edi_get_fiscal_regimen_code(self):
        if self.l10n_co_edi_fiscal_regimen == '48':
            return '01'
        if self.l10n_co_edi_fiscal_regimen == '49':
            return 'ZZ'
        return self.l10n_co_edi_fiscal_regimen

    def _l10n_co_edi_get_fiscal_regimen_name(self):
        return dict(self._fields["l10n_co_edi_fiscal_regimen"].selection).get(self.l10n_co_edi_fiscal_regimen)
