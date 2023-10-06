# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import _, api, models, fields
from odoo.exceptions import ValidationError
import re


class ResCompany(models.Model):
    _inherit = "res.company"

    l10n_lu_agent_vat = fields.Char(
        string="Agent's VAT",
        help="VAT number of the accounting firm (agent company) acting as the declarer in eCDF declarations")
    l10n_lu_agent_matr_number = fields.Char(
        string="Agent's Matr Number",
        help="National ID number of the accounting firm (agent company) acting as the declarer in eCDF declarations")
    l10n_lu_agent_ecdf_prefix = fields.Char(
        string="Agent's ECDF Prefix",
        help="eCDF prefix (identifier) of the accounting firm (agent company) acting as the declarer in eCDF declarations")
    l10n_lu_agent_rcs_number = fields.Char(
        string="Agent's Company Registry",
        help="RCS (Régistre de Commerce et des Sociétés) of the accounting firm (agent company) acting as the declarer in eCDF declarations")

    @api.constrains('l10n_lu_agent_matr_number')
    def _check_agent_matr_number(self):
        matr_number_re = re.compile('[0-9]{11,13}')
        for record in self:
            if record.l10n_lu_agent_matr_number and not matr_number_re.match(record.l10n_lu_agent_matr_number):
                raise ValidationError(_("The Agent's Matr. Number is not valid. There should be between 11 and 13 digits."))

    @api.constrains('l10n_lu_agent_ecdf_prefix')
    def _check_agent_ecdf_prefix(self):
        ecdf_re = re.compile('[0-9A-Z]{6}')
        for record in self:
            if record.l10n_lu_agent_ecdf_prefix and not ecdf_re.match(record.l10n_lu_agent_ecdf_prefix):
                raise ValidationError(_("The Agent's ECDF Prefix is not valid. There should be exactly 6 characters."))
