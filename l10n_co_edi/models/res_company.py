# coding: utf-8
from odoo import api, fields, models, _

TEMPLATE_CODE = [
    ('01', 'CGEN03'),
    ('02', 'CGEN04'),
]


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_co_edi_username = fields.Char(string='Username', groups='base.group_system')
    l10n_co_edi_password = fields.Char(string='Password', groups='base.group_system')
    l10n_co_edi_company = fields.Char(string='Company ID')
    l10n_co_edi_account = fields.Char(string='Account ID', groups='base.group_system')
    l10n_co_edi_test_mode = fields.Boolean(string='Test mode', default=True)

    l10n_co_edi_header_gran_contribuyente = fields.Char(string='Gran Contribuyente')
    l10n_co_edi_header_tipo_de_regimen = fields.Char(string=u'Tipo de Régimen')
    l10n_co_edi_header_retenedores_de_iva = fields.Char(string='Retenedores de IVA')
    l10n_co_edi_header_autorretenedores = fields.Char(string='Autorretenedores')
    l10n_co_edi_header_resolucion_aplicable = fields.Char(string='Resolucion Aplicable')
    l10n_co_edi_header_actividad_economica = fields.Char(string='Actividad Económica')
    l10n_co_edi_header_bank_information = fields.Text(string='Bank Information')
    l10n_co_edi_template_code = fields.Selection(TEMPLATE_CODE, string="Colombia Template Code")

    def _get_l10n_co_edi_template_code_description(self):
        return dict(TEMPLATE_CODE).get(self.l10n_co_edi_template_code)

