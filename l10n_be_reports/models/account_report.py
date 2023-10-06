# -*- coding: utf-8 -*-

import re
from odoo import models, _
from odoo.exceptions import UserError


class AccountReport(models.AbstractModel):
    _inherit = 'account.report'

    def _get_belgian_xml_export_representative_node(self):
        """ The <Representative> node is common to XML exports made for VAT Listing, VAT Intra,
        and tax declaration. It is used in case the company isn't submitting its report directly,
        but through an external accountant.

        This function relies on a config parameter to get the representative, since this feature
        was introduced in stable.

        :return: The string containing the complete <Representative> node or an empty string,
                 in case no representative has been configured.
        """
        representative_id = int(self.env['ir.config_parameter'].sudo().get_param('l10n_be_reports.xml_export_representative_%s' % self.env.company.id))
        if representative_id:
            representative = self.env['res.partner'].browse(representative_id)
            representative_country_code = representative.country_id.code.upper()

            node_values = {
                'vat': representative.vat[2:] if representative.vat[:2] == representative_country_code else representative.vat,
                'name': representative.name,
                'street': (representative.street or '') + (' ' + representative.street2 if representative.street2 else ''),
                'zip': representative.zip,
                'city': representative.city,
                'country_code': representative_country_code,
                'mail': representative.email,
                'phone': self._raw_phonenumber(representative.phone) or self._raw_phonenumber(representative.mobile)
            }

            if any(not value for value in node_values.values()):
                raise UserError(_("Please first fill in the full coordinates (address, VAT, mail and phone) of the representative configured for your xml export (%s)") % representative.name)

            vat_country_code = representative.vat[:2].upper()
            countries_count = self.env['res.country'].search([('code', 'ilike', vat_country_code)], count=True)
            node_values['vat_country_code'] = vat_country_code if countries_count else node_values['country_code']

            return """
                <ns2:Representative>
                    <RepresentativeID identificationType="NVAT" issuedBy="%(vat_country_code)s">%(vat)s</RepresentativeID>
                    <Name>%(name)s</Name>
                    <Street>%(street)s</Street>
                    <PostCode>%(zip)s</PostCode>
                    <City>%(city)s</City>
                    <CountryCode>%(country_code)s</CountryCode>
                    <EmailAddress>%(mail)s</EmailAddress>
                    <Phone>%(phone)s</Phone>
                </ns2:Representative>
            """ % node_values

        return ""

    def _raw_phonenumber(self, phonenumber):
        return re.sub("[^+0-9]", "", phonenumber)[:20]
