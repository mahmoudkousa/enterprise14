# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta
from odoo import models, api, _
from odoo.tools.misc import formatLang
from odoo.exceptions import UserError

class ReportL10nLuPartnerVatIntra(models.AbstractModel):
    _name = "l10n.lu.report.partner.vat.intra"
    _description = "Partner VAT Intra"
    _inherit = 'account.report'

    filter_date = {'mode': 'range', 'filter': 'this_month'}
    filter_journals = True
    filter_multi_company = None

    filter_intrastat_code = None

    @api.model
    def _init_filter_intrastat_code(self, options, previous_options=None):
        if previous_options and 'intrastat_code' in previous_options:
            options['intrastat_code'] = previous_options['intrastat_code']
        else:
            options['intrastat_code'] = [
                {'id': 'Shipment', 'name': 'L', 'selected': False, 'lines': self.env.ref('l10n_lu.account_tax_report_line_1b_1_intra_community_goods_pi_vat').ids},
                {'id': 'Triangular', 'name': 'T', 'selected': False, 'lines': self.env.ref('l10n_lu.account_tax_report_line_1b_6_a_subsequent_to_intra_community').ids},
                {'id': 'Services', 'name': 'S', 'selected': False, 'lines': self.env.ref('l10n_lu.account_tax_report_line_1b_6_b1_non_exempt_customer_vat').ids},
            ]

    def _get_columns_name(self, options):
        return [
            {'name': ''},
            {'name': _('Country Code')},
            {'name': _('VAT Number')},
            {'name': _('Code')},
            {'name': _('Amount'), 'class': 'number'},
        ]

    def _get_lines(self, options, line_id=None, get_xml_data=False):
        self.env['account.move.line'].check_access_rights('read')
        lines = []
        l_lines = []
        t_lines = []
        s_lines = []
        context = self.env.context
        l_sum = t_sum = s_sum = 0

        select = 'partner.vat AS vat, SUM(-aml.balance) AS amount, report_line.account_tax_report_line_id AS report_line_id'
        group_by = 'partner.vat, report_line.account_tax_report_line_id, country.code'
        order_by = "report_line.account_tax_report_line_id"
        if not get_xml_data:
            select += ', partner.name AS partner_name, aml.partner_id'
            group_by += ', aml.partner_id, partner.name'
            order_by += ', partner_name'
        else:
            select += ", STRING_AGG (partner.name, ', ') AS partner_name"

        query = f"""
        SELECT {select}
          FROM account_move_line aml
          JOIN res_partner partner ON aml.partner_id = partner.id
          JOIN account_account_tag_account_move_line_rel aml_tag ON aml.id = aml_tag.account_move_line_id
          JOIN account_account_tag tag ON tag.id = aml_tag.account_account_tag_id
          JOIN account_tax_report_line_tags_rel report_line ON report_line.account_account_tag_id = tag.id
          JOIN res_country country ON partner.country_id = country.id
         WHERE report_line.account_tax_report_line_id IN %s
           AND aml.parent_state = 'posted'
           AND aml.company_id = %s
           AND aml.date >= %s
           AND aml.date <= %s
         GROUP BY {group_by}
         ORDER BY {order_by}
        """
        report_lines = []
        rep_ln_to_code = {}
        show_all = not(any([code['selected'] for code in options['intrastat_code']]))
        for code in options['intrastat_code']:
            for ln in code['lines']:
                if show_all or code['selected']:
                    report_lines.append(ln)
                rep_ln_to_code[ln] = code['name']
        params = (tuple(report_lines), self.env.company.id, options['date']['date_from'], options['date']['date_to'])
        self.env.cr.execute(query, params)

        for row in self.env.cr.dictfetchall():
            if not row['vat']:
                row['vat'] = ''

            amt = row['amount'] or 0.0
            if amt:
                if get_xml_data and not row['vat']:
                    raise UserError(_('Partner "%s" has no VAT Number.', row['partner_name']))
                country_code = row['vat'][:2].upper()
                intrastat_code = rep_ln_to_code[row['report_line_id']]
                columns = [
                    country_code,
                    row['vat'][2:].replace(' ', '').upper(),
                    intrastat_code,
                    context.get('get_xml_data') and ('%.2f' % amt).replace('.', ',') or amt,
                ]
                if not context.get('no_format', False):
                    currency_id = self.env.company.currency_id
                    columns[3] = formatLang(self.env, columns[3], currency_obj=currency_id)

                if context.get('get_xml_data'):
                    if intrastat_code == 'L':
                        l_sum += amt
                        l_lines.append(columns)
                    elif intrastat_code == 'T':
                        t_sum += amt
                        t_lines.append(columns)
                    else:
                        s_sum += amt
                        s_lines.append(columns)
                else:
                    lines.append({
                        'id': row['partner_id'] if not get_xml_data else False,
                        'caret_options': 'res.partner',
                        'model': 'res.partner',
                        'name': row['partner_name'] if not get_xml_data else False,
                        'columns': [{'name': v } for v in columns],
                        'unfoldable': False,
                        'unfolded': False,
                    })

        if context.get('get_xml_data'):
            return {
                'l_lines': l_lines,
                't_lines': t_lines,
                's_lines': s_lines,
                'l_sum': ('%.2f' % l_sum).replace('.', ','),
                't_sum': ('%.2f' % t_sum).replace('.', ','),
                's_sum': ('%.2f' % s_sum).replace('.', ','),
            }
        return lines

    def _is_lu_electronic_report(self):
        return self.env.company.country_id.code == 'LU'

    def _get_report_data(self, options):
        date_from = options['date'].get('date_from')
        date_to = options['date'].get('date_to')
        dt_from = datetime.strptime(date_from, '%Y-%m-%d')
        dt_to = datetime.strptime(date_to, '%Y-%m-%d')

        month = None
        quarter = None
        # dt_from is 1st day of months 1,4,7 or 10 and dt_to is last day of dt_from month+2
        if dt_from.day == 1 and dt_from.month % 3 == 1 and dt_to == dt_from + relativedelta(day=31, month=dt_from.month + 2):
            quarter = (dt_from.month + 2) / 3
        # dt_from is 1st day & dt_to is last day of same month
        elif dt_from.day == 1 and dt_from + relativedelta(day=31) == dt_to:
            month = date_from[5:7]
        else:
            raise UserError(_('Check from/to dates. XML must cover 1 full month or 1 full quarter.'))
        year = date_from[:4]

        ctx = self._set_context(options)
        ctx.update({'no_format': True, 'date_from': date_from, 'date_to': date_to, 'get_xml_data': True})
        xml_data = self.with_context(ctx)._get_lines(options, get_xml_data=True)

        return xml_data, month, quarter, year

    def get_xml(self, options):
        # Check
        company = self.env.company
        errors = []
        self._lu_validate_ecdf_prefix()
        company_vat = company.partner_id.vat
        if not company_vat:
            errors.append(_('VAT'))
        matr_number = company.matr_number
        if not matr_number:
            errors.append(_('Matr Number'))
        if errors:
            raise UserError(_('The following must be set on your company:\n- %s') % ('\n- '.join(errors)))

        rcs_number = company.company_registry or 'NE'

        file_ref = options['filename']
        company_vat = company_vat.replace(' ', '').upper()[2:]

        xml_data, month, quarter, year = self._get_report_data(options)

        xml_data.update({
            "file_ref": file_ref,
            "matr_number": matr_number,
            "rcs_number": rcs_number,
            "company_vat": company_vat,
            "year": year,
            "period": month or quarter,
            "type_labes": month and ['TVA_LICM', 'TVA_PSIM'] or ['TVA_LICT', 'TVA_PSIT'],
        })

        rendered_content = self.env['ir.qweb']._render('l10n_lu_reports_electronic.IntrastatLuXMLReport', xml_data)
        return b"<?xml version='1.0' encoding='utf-8'?>" + rendered_content
