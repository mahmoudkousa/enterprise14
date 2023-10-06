# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import logging
import requests
from lxml import etree, objectify

from odoo import models

_logger = logging.getLogger(__name__)


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    def _load_xsd_lu_electronic_files(self):
        """
        Loads XSD file for checking LU electronic XML reports. Allows to check that the generated reports are in the 
        right XML schema before exporting them.
        """
        attachment = self.env.ref('l10n_lu_reports_electronic_xml_2_0.xsd_cached_eCDF_file_v2_0-XML_schema_xsd', False)
        if attachment:
            return
        try:
            # XSD file provided by eCDF (LU official electronic plaftorm for the collection of financial data)
            response = requests.get('https://ecdf-developer.b2g.etat.lu/ecdf/formdocs/eCDF_file_v2.0-XML_schema.xsd', timeout=10)
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            _logger.info('Cannot connect with the given URL for the Luxembourg electronic reports xsd.')
            return
        try:
            objectify.fromstring(response.content)
        except etree.XMLSyntaxError as e:
            _logger.info('You are trying to load an invalid xsd file for the Luxembourg electronic reports.\n%s', e)
            return
        attachment = self.create({
            'name': 'xsd_cached_eCDF_file_v2_0-XML_schema_xsd',
            # removing \P{Cc} character class because it seems to pose trouble in the validation, even for valid files
            'datas': base64.encodebytes(response.content.replace(b'<xsd:pattern value="[\\P{Cc}]+" />', b'')),
        })
        self.env['ir.model.data'].create({
            'name': 'xsd_cached_eCDF_file_v2_0-XML_schema_xsd',
            'module': 'l10n_lu_reports_electronic_xml_2_0',
            'res_id': attachment.id,
            'model': 'ir.attachment',
            'noupdate': True
        })
        return super()._load_xsd_lu_electronic_files()
