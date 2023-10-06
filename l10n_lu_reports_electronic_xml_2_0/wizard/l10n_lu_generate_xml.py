# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import re
from io import BytesIO
from datetime import datetime
from odoo import api, models, fields, tools, _
from odoo.exceptions import ValidationError

class L10nLuGenerateXML(models.TransientModel):
    """
    This wizard is used to generate xml reports for Luxembourg
    according to the xml 2.0 standard.
    """
    _name = 'l10n_lu.generate.xml'
    _description = 'Generate Xml 2.0'

    # since the only required agent's field is the Matr. Number, if it is given, use Agent's information
    by_fidu = fields.Boolean(string="Declaration Filled in by Fiduciary",
                             default=lambda self: self.env.company.l10n_lu_agent_matr_number)
    report_data = fields.Binary('Report file', readonly=True, attachment=False)
    filename = fields.Char(string='Filename', size=256, readonly=True)

    def _lu_validate_xml_content(self, content):
        attachment = self.env.ref('l10n_lu_reports_electronic_xml_2_0.xsd_cached_eCDF_file_v2_0-XML_schema_xsd',
                                  raise_if_not_found=False)
        if attachment:
            xsd_datas = base64.b64decode(attachment.sudo().datas) if attachment else b''
            with BytesIO(xsd_datas) as xsd:
                tools.xml_utils._check_with_xsd(content, xsd)
        return True

    def get_xml(self, lu_annual_report=False):
        """
        Generates the XML report.
        lu_annual_report contains the report id of the manual annual report.
        """
        company = self.env.company
        if self.by_fidu and not company.l10n_lu_agent_ecdf_prefix:
            raise ValidationError(_("The accouning firm's ECDF Prefix still hasn't been defined! "
                                    "Either uncheck 'Declarations and Filings done by the Accounting Firm' "
                                    "or add the accounting firm's information in the company's information."))
        if not self.by_fidu and not company.ecdf_prefix:
            raise ValidationError(_("The ECDF Prefix hasn't been defined. Please add the ECDF prefix in the company's information."))

        now_datetime = datetime.now()
        file_ref_data = {
            'ecdf_prefix': company.l10n_lu_agent_ecdf_prefix if self.by_fidu else company.ecdf_prefix,
            'datetime': now_datetime.strftime('%Y%m%dT%H%M%S%f')[:-4]
        }
        filename = '{ecdf_prefix}X{datetime}'.format(**file_ref_data)

        # The Matr. Number is required
        if self.by_fidu and not company.l10n_lu_agent_matr_number:
            raise ValidationError(_("The accouning firm's Matr. Number still hasn't been defined! "
                                    "Either uncheck 'Declarations and Filings done by the Accounting Firm' "
                                    "or add the accounting firm's information in the company's information."))
        vat = company.l10n_lu_agent_vat if self.by_fidu else company.vat
        if vat and vat.startswith("LU"):  # Remove LU prefix in the XML
            vat = vat[2:]
        language = self.env.context.get('lang', '').split('_')[0].upper()
        language = language in ('EN', 'FR', 'DE') and language or 'EN'
        if self.env.context.get('report_generation_options'):
            self.env.context['report_generation_options']['language'] = language
        lu_template_values = {
            'filename': filename,
            'lang': language,
            'interface': 'MODL5',
            'agent_vat': vat or "NE",
            'agent_matr_number': (company.l10n_lu_agent_matr_number if self.by_fidu else company.matr_number) or "NE",
            'agent_rcs_number': (company.l10n_lu_agent_rcs_number if self.by_fidu else company.company_registry) or "NE",
            'declarations': []
        }
        vat = company.vat
        if vat and vat.startswith("LU"):  # Remove LU prefix in the XML
            vat = vat[2:]
        # The Matr. Number is required
        if not company.matr_number:
            raise ValidationError(_("The company's Matr. Number still hasn't been defined! "
                                    "Add it in the company's information."))
        declaration_template_values = {
            'vat_number': vat or "NE",
            'matr_number': company.matr_number or "NE",
            'rcs_number': company.company_registry or "NE",
        }
        if lu_annual_report:
            declarations_data = lu_annual_report._lu_get_declarations(declaration_template_values)
            self._save_xml_report(declarations_data, lu_template_values, filename, lu_annual_report)
            url = "web/content/?model=" + lu_annual_report._name + "&id=" + str(lu_annual_report.id) + "&filename_field=filename&field=report_data&download=true&filename=" + lu_annual_report.filename
        else:
            declarations_data = self._lu_get_declarations(declaration_template_values)
            self._save_xml_report(declarations_data, lu_template_values, filename)
            url = "web/content/?model=" + self._name + "&id=" + str(self.id) + "&filename_field=filename&field=report_data&download=true&filename=" + self.filename
        return {
            'name': 'XML Report',
            'type': 'ir.actions.act_url',
            'url': url,
            'target': 'new',
        }

    def _save_xml_report(self, declarations_data, lu_template_values, filename, lu_annual_report=False):
        lu_template_values['declarations'] = declarations_data['declarations']

        # Add function to format floats
        lu_template_values['format_float'] = lambda f: tools.float_utils.float_repr(f, 2).replace('.', ',')
        rendered_content = self.env.ref('l10n_lu_reports_electronic_xml_2_0.l10n_lu_electronic_report_template')._render(lu_template_values)

        content = "\n".join(re.split(r'\n\s*\n', rendered_content.decode("utf-8")))
        self._lu_validate_xml_content(content)
        self.env['account.report']._lu_validate_ecdf_prefix()
        vals = {
            'report_data': base64.b64encode(bytes(content, 'utf-8')),
            'filename': filename + '.xml'
        }
        if lu_annual_report:
             lu_annual_report.write(vals)
        else:
            self.write(vals)

    def _lu_get_declarations(self, declaration_template_values):
        values = self.env[self.env.context['model']]._get_lu_xml_2_0_report_values(self.env.context['account_report_generation_options'])
        declarations = {'declaration_singles': {'forms': values['forms']}, 'declaration_groups': []}
        declarations.update(declaration_template_values)
        return {'declarations': [declarations]}
