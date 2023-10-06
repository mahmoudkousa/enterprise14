# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from datetime import datetime
from dateutil.relativedelta import relativedelta
from odoo import _, models
from odoo.exceptions import UserError

class ReportAccountFinancialReport(models.Model):
    _inherit = "account.financial.html.report"

    def _get_reports_buttons(self):
        res = super()._get_reports_buttons()
        if self._is_lu_electronic_report() and self.env.company.country_id.code == 'LU':
            for re in res:
                if re.get('action') == 'print_xml':
                    # deactivate xml export & saving
                    # and allow export of the XML declaration from the wizard
                    re['name'] = _('EXPORT ECDF DECLARATION')
                    re['action'] = 'l10n_lu_open_report_export_wizard'
                    del re['file_export_type']
        return res

    def _get_lu_xml_2_0_report_values(self, options, references=False):
        """Returns the formatted report values for this financial report.
           (Balance sheet: https://ecdf-developer.b2g.etat.lu/ecdf/forms/popup/CA_BILAN_COMP/2020/en/2/preview),
            Profit&Loss: https://ecdf-developer.b2g.etat.lu/ecdf/forms/popup/CA_COMPP_COMP/2020/en/2/preview)
           Adds the possibility to add references to the report and the form model number to
           _get_lu_electronic_report_values.

           :param options: the report options
           :param references: whether the annotations on the financial report should be added to the report as references
           :returns: the formatted report values
        """
        def _get_references():
            """
            This returns the annotations on all financial reports, linked to the corresponding report reference field.
            These will be used as references in the report.
            """
            references = {}
            names = {}
            notes = self.env['account.report.manager'].search([
                ('company_id', '=', self.env.company.id),
                ('financial_report_id', '=', self.id)
            ]).footnotes_ids
            for note in notes:
                # for footnotes on accounts on financial reports, the line field will be:
                # 'financial_report_group_xxx_yyy', with xxx the line id and yyy the account id
                split = note.line.split('_')
                if len(split) > 1 and split[-2].isnumeric() and split[-1].isnumeric():
                    line = self.env['account.financial.html.report.line'].search([('id', '=', split[-2])], limit=1)
                    code = re.search(r'\d+', str(line.code))
                    if code:
                        # References in the eCDF report have codes equal to the report code of the referred account + 1000
                        code = str(int(code.group()) + 1000)
                        references[code] = {'value': note.text, 'field_type': 'char'}
                        names[code] = self.env['account.account'].search([("id", "=", split[-1])]).mapped('code')[0]
            return references, names

        lu_template_values = self._get_lu_electronic_report_values(options)
        for form in lu_template_values['forms']:
            if references:
                references, names = _get_references()
                # Only add those references on accounts with reported values (for the current or previous year);
                # the reference has an eCDF code equal to the report code of the referred account for the current year + 1000,
                # ot equal to the report code of the ref. account for the previous year + 999
                references = {r: references[r] for r in references.keys()
                              if str(int(r) - 1000) in form['field_values'] or str(int(r) - 999) in form['field_values']}
                names = {r: names[r] for r in references.keys()
                         if str(int(r) - 1000) in form['field_values'] or str(int(r) - 999) in form['field_values']}
                # Check the length of the references <= 10 (XML report limit)
                if any([len(r['value']) > 10 for r in references.values()]):
                    raise UserError(
                        _("Some references are not in the requested format (max. 10 characters):") + "\n    " +
                        "\n    ".join([names[i[0]] + ": " + i[1]['value'] for i in references.items() if len(i[1]['value']) > 10]) +
                        "\n" + _("Cannot export them.")
                    )
                for ref in references:
                    form['field_values'].update({ref: references[ref]})
            model = 2 if form['year'] == 2020 else 1
            form['model'] = model
        return lu_template_values['forms']

    def l10n_lu_open_report_export_wizard(self, options):
        """ Creates a new export wizard for this report."""
        new_context = self.env.context.copy()
        new_context['account_report_generation_options'] = options
        # When exporting from the balance sheet, the date_from must be adjusted
        if options['date']['mode'] == 'single':
            date_from = datetime.strptime(options['date']['date_to'], '%Y-%m-%d') + relativedelta(years=-1, days=1)
            new_context['account_report_generation_options']['date']['date_from'] = date_from.strftime('%Y-%m-%d')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Export'),
            'view_mode': 'form',
            'res_model': 'l10n_lu.generate.accounts.report',
            'target': 'new',
            'views': [[self.env.ref('l10n_lu_reports_electronic_xml_2_0.view_l10n_lu_generate_accounts_report').id, 'form']],
            'context': new_context,
        }
