from odoo import models, fields, _
from odoo.exceptions import UserError
from odoo.tools import float_repr
from lxml import etree
from datetime import date, datetime


class AccountGenericTaxReport(models.AbstractModel):
    _inherit = 'account.generic.tax.report'

    def _get_reports_buttons(self):
        buttons = super(AccountGenericTaxReport, self)._get_reports_buttons()
        if self.env.company.country_id.code == 'DE':
            buttons += [{'name': _('Export (XML)'), 'sequence': 3, 'action': 'print_xml', 'file_export_type': _('XML')}]
        return buttons

    def get_xml(self, options):
        if self.env.company.country_id.code != 'DE':
            return super().get_xml(options)
        ctx = self._set_context(options)
        report_lines = self.with_context(ctx)._get_lines(options)

        de_tax_report = self.env.ref('l10n_de.tax_report')
        report_lines_have_codes = self.env['account.tax.report.line'].search([('report_id', '=', de_tax_report.id), ('code', '!=', None)], limit=1)
        if not self.env.ref('l10n_de_reports.tax_export_xml', raise_if_not_found=False) or not report_lines_have_codes:
            raise UserError('The template of the report has not been found, please update modules "l10n_de" and "l10n_de_reports".')

        template_context = {}
        date_to = datetime.strptime(options['date']['date_to'], '%Y-%m-%d')
        template_context['year'] = date_to.year
        if options['date']['period_type'] == 'month':
            template_context['period'] = date_to.strftime("%m")
        elif options['date']['period_type'] == 'quarter':
            month_end = int(date_to.month)
            if month_end % 3 != 0:
                raise ValueError('Quarter not supported')
            # For quarters, the period should be 41, 42, 43, 44 depending on the quarter.
            template_context['period'] = int(month_end / 3 + 40)
        template_context['creation_date'] = date.today().strftime("%Y%m%d")
        template_context['company'] = self.env.company

        qweb = self.env['ir.qweb']
        doc = qweb._render('l10n_de_reports.tax_export_xml', values=template_context)
        parser = etree.XMLParser(remove_blank_text=True)
        tree = etree.fromstring(doc, parser)

        taxes = tree.xpath('//Umsatzsteuervoranmeldung')[0]
        # Add the values dynamically. We do it here because the tag is generated from the code and
        # Qweb doesn't allow dynamically generated tags.

        for line in report_lines:
            if not line['line_code']:
                continue
            # all "Kz" may be supplied as negative, except "Kz37", "Kz39", "Kz50"
            line_balance = line['columns'][0]['balance']
            if line_balance and (line['line_code'] not in ("37", "39", "50") or line_balance > 0):
                elem = etree.SubElement(taxes, "Kz" + line['line_code'])
                # These can not be supplied with decimals
                if line['line_code'] in ("21", "35", "41", "42", "43", "44", "45", "46", "48", "49", "50", "60", "73",
                                 "76", "77", "81", "84", "86", "87", "89", "91", "93", "90", "94", "95"):
                    elem.text = float_repr(int(line_balance), 0)
                elif line['line_code'] in ("66", "61", "62", "67", "63", "59", "64",):
                    # These are taxes that are on the wrong sign on the report compared to what should be exported
                    elem.text = float_repr(- line_balance, 2).replace('.', ',')
                else:
                    elem.text = float_repr(line_balance, 2).replace('.', ',')

            # "kz83" must be supplied with 0.00 if it doesn't have balance
            elif line['line_code'] == "83":
                elem = etree.SubElement(taxes, "Kz" + line['line_code'])
                elem.text = "0,00"

        return etree.tostring(tree, pretty_print=True, standalone=False, encoding='ISO-8859-1',)
