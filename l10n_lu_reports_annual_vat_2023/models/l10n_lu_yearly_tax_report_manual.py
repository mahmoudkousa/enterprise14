# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class L10nLuYearlyTaxReportManual(models.Model):
    """
    Extends the existing annual tax report with additional fields added for 2023 declarations for manual data entry.
    """
    _inherit = ['l10n_lu.yearly.tax.report.manual']

    # ==== Business fields ====
    # 1.Purchases of goods (within the territory of Luxembourg or abroad and subsequently brought to Luxembourg) which give rise to a chargeable event for the supplier or for the taxable person acquiring the goods
    # a) Purchases within the country (13)
    # 1) Purchases other than manufactured tobacco rate of
    report_section_971 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_972 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_973 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    # b) Intra-Community acquisitions
    # 1) Acquisitions other than manufactured tobacco
    # rate of
    report_section_976 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_977 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_978 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    # c) Imports (16)
    # 1) Imports other than manufactured tobacco
    # rate of
    report_section_981 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_982 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_983 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    # E. Stock / Miscellaneous (amounts VAT excluded)
    # 1.Total stock and tobacco
    # a) Stock not falling within the scope of Art. 56ter-1 and 56ter-2 and manufactured tobacco referred to in b) excluded
    # rate of
    report_section_991 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_992 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_993 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_994 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_995 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)
    report_section_996 = fields.Float(states={'exported': [('readonly', True)]}, tracking=True)

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------
    @api.depends(
        "report_section_971", "report_section_972", "report_section_973", "report_section_976",
        "report_section_977", "report_section_978", "report_section_981", "report_section_982",
        "report_section_981", "report_section_991", "report_section_993", "report_section_995",
        "report_section_992", "report_section_994", "report_section_996",
    )
    def _compute_new_totals(self):
        super()._compute_new_totals()

        for record in self:
            record.report_section_129 += record.report_section_971 + record.report_section_972 + record.report_section_973
            record.report_section_137 += record.report_section_976 + record.report_section_977 + record.report_section_978
            record.report_section_145 += record.report_section_981 + record.report_section_982 + record.report_section_983
            record.report_section_163 += record.report_section_991 + record.report_section_993 + record.report_section_995
            record.report_section_176 += record.report_section_992 + record.report_section_994 + record.report_section_996
            record.report_section_131 = record.report_section_129 + record.report_section_130
            record.report_section_139 = record.report_section_137 + record.report_section_138
            record.report_section_147 = record.report_section_145 + record.report_section_146
            record.report_section_168 = record.report_section_163 + record.report_section_167
            record.report_section_181 = record.report_section_176 + record.report_section_180
            record.report_section_148 = record.report_section_131 + record.report_section_139 + record.report_section_147
            record.report_section_154 = record.report_section_148 + record.report_section_150 + record.report_section_151

    def export_pdf(self):
        self.ensure_one()
        if self.env.company.account_tax_fiscal_country_id.code != "LU":
            raise UserError(_("The fiscal country of your active company is not Luxembourg. This export is not available for other countries."))

        file_ref_data = {
            'ecdf_prefix': self.company_id.ecdf_prefix,
            'datetime': datetime.now().strftime('%Y%m%dT%H%M%S%f')[:-4]
        }
        filename = '{ecdf_prefix}X{datetime}'.format(**file_ref_data)
        form_data = self._lu_get_declarations({})['declarations'][0]['declaration_singles']['forms'][0]
        field_values = form_data['field_values']
        appendix = form_data.get('tables')
        user = self.env['res.users'].browse(self.env.uid)
        render_values = {
            'field_values': field_values,
            'appendix': appendix[0] if appendix else None,
            'year': form_data['year'],
            'company_name': self.company_id.name,
            'context_timestamp': lambda t: fields.Datetime.context_timestamp(self.with_context(tz=user.tz), t),
            'company': self.env.company,
        }
        report, dummy = self.env.ref('l10n_lu_reports_annual_vat_2023.action_report_l10n_lu_tax_report').sudo()._render_qweb_pdf(data=render_values)

        attachment = self.env['ir.attachment'].create({
            'name': f'{filename}.pdf',
            'raw': report,
            'res_id': self.id,
            'res_model': self._name,
            'type': 'binary',
            'mimetype': 'application/pdf',
        })
        if attachment:
            self.message_post(attachment_ids=attachment.ids)
