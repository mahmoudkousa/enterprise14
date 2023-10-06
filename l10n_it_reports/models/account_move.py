# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.tools import format_date
from dateutil.relativedelta import relativedelta


class AccountMove(models.Model):
    _inherit = "account.move"

    def _post(self, soft=True):
        def _get_line_data(tax_report_line_id, line):
            account_id = self.env['account.tax.repartition.line'].search([
                ('company_id', '=', self.env.company.id),
                ('invoice_tax_id.active', '=', True),
                ('account_id', '!=', False),
                ('repartition_type', '=', 'tax'),
            ], limit=1).account_id.id
            tax_report_line = self.env['account.tax.report.line'].browse(tax_report_line_id)
            tag_ids = tax_report_line.tag_ids.filtered(lambda t: not t.tax_negate).ids

            return [
                (0, 0, {
                    'tax_tag_ids': [(6, 0, tag_ids)],
                    'account_id': account_id,
                    'debit': line['columns'][0]['balance'],
                }),
                (0, 0, {
                    'account_id': account_id,
                    'credit': line['columns'][0]['balance'],
                })
            ]

        report = self.env['account.generic.tax.report']

        # Only handle this behavior on tax closing entries for an Italian company, that has not been posted before.
        moves_to_treat = self.filtered(lambda m: m.tax_closing_end_date
                                                 and not m.posted_before
                                                 and m.company_id.country_id.code == 'IT')
        for move in moves_to_treat:
            options = self._compute_vat_period_date()
            report_lines = report.with_context(report._set_context(options))._get_lines(options)

            # Get all of the report lines that are relevant to the current situation.
            report_line_map = {l.get('line_code'): l for l in report_lines}
            end_of_period_date = fields.Date.from_string(options['date']['date_to'])
            lines_data = []

            # Line VP14 credit.
            if report_line_map['VP14b']['columns'][0]['balance'] != 0:
                # If we are closing the year, we want the value of the line VP14 credit to be on the line VP9.
                # Otherwise, we want it on the line VP8.
                if end_of_period_date.month == 12:
                    lines_data.extend(_get_line_data(report_line_map['VP9']['id'], report_line_map['VP14b']))
                else:
                    lines_data.extend(_get_line_data(report_line_map['VP8']['id'], report_line_map['VP14b']))

            # Line VP14 debt: only if the amount is between 0 and 25.82.
            if 0 < report_line_map['VP14a']['columns'][0]['balance'] <= 25.82:
                lines_data.extend(_get_line_data(report_line_map['VP7']['id'], report_line_map['VP14a']))

            if len(lines_data) > 0:
                # Add a ref to the created move to make it easier to understand what it is.
                activity_type = move.company_id.account_tax_next_activity_type or False
                if not activity_type or activity_type.delay_count == 1:
                    formatted_date = format_date(self.env, end_of_period_date, date_format='LLLL')
                else:
                    formatted_date = format_date(self.env, end_of_period_date, date_format='qqq')

                # Create the move for the next day after, bringing these values to the next period declaration.
                self.env['account.move'].create({
                    'journal_id': move.journal_id.id,
                    'move_type': 'entry',
                    'date': end_of_period_date + relativedelta(days=1),
                    'line_ids': lines_data,
                    'ref': _('Carryover for %s') % (formatted_date,)
                })._post()

        return super()._post(soft)
