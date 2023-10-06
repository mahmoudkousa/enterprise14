# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields
from odoo.tools import safe_eval
from odoo.tools.translate import _
from odoo.exceptions import UserError, RedirectWarning
import re
from collections import defaultdict
from itertools import chain


class generic_tax_report(models.AbstractModel):
    _inherit = 'account.report'
    _name = 'account.generic.tax.report'
    _description = 'Generic Tax Report'

    filter_multi_company = True # Actually disabled by default, can be activated by config parameter (see _get_options)
    filter_date = {'mode': 'range', 'filter': 'last_month'}
    filter_all_entries = False
    filter_comparison = {'date_from': '', 'date_to': '', 'filter': 'no_comparison', 'number_period': 1}
    filter_tax_report = None

    def _init_filter_tax_report(self, options, previous_options=None):
        options['available_tax_reports'] = []
        available_reports = self.env.company.get_available_tax_reports()
        for report in available_reports:
            options['available_tax_reports'].append({
                'id': report.id,
                'name': report.name,
            })
        # The computation of lines groupped by account require calling `compute_all` with the
        # param handle_price_include set to False. This is not compatible with taxes of type group
        # because the base amount can affect the computation of other taxes; hence we disable the
        # option if there are taxes with that configuration.
        options['by_account_available'] = not self.env['account.tax'].search([
            ('amount_type', '=', 'group'),
        ], limit=1)

        options['tax_report'] = (previous_options or {}).get('tax_report')

        generic_reports_with_groupby = {'account_tax', 'tax_account'}

        if options['tax_report'] not in {0, *generic_reports_with_groupby} and options['tax_report'] not in available_reports.ids:
            # Replace the report in options by the default report if it is not the generic report
            # (always available for all companies) and the report in options is not available for this company
            options['tax_report'] = available_reports and available_reports[0].id or 0

        if options['tax_report'] in generic_reports_with_groupby:
            options['group_by'] = options['tax_report']
        else:
            options['group_by'] = False

    def _init_filter_date(self, options, previous_options=None):
        # OVERRIDE
        super()._init_filter_date(options, previous_options=previous_options)
        options['date']['strict_range'] = True

    @api.model
    def _get_options(self, previous_options=None):
        rslt = super(generic_tax_report, self)._get_options(previous_options)

        if self.env['ir.config_parameter'].sudo().get_param('account_tax_report_multi_company'):
            if len(self.env.companies.mapped('currency_id')) > 1:
                raise UserError(_("The multi-company option of the tax report does not allow opening it for companies in different currencies."))

        elif 'multi_company' in rslt:
            # filter_multi_company is readonly. Hence, it cannot be modified before calling super().
            # However, we only want multi company activated on the tax report if the config parameter
            # is set. By default, it has to be disabled. So, we remove it from the resulting options.
            del rslt['multi_company']

        tables, where_clause, where_params = self._query_get(rslt)
        self._cr.execute(f"""
            SELECT 1
            FROM {tables}
            JOIN account_account_tag_account_move_line_rel aml_tag
                ON account_move_line.id = aml_tag.account_move_line_id
            JOIN account_account_tag tag
                ON aml_tag.account_account_tag_id = tag.id
            WHERE {where_clause}
            AND NOT tag.active
            LIMIT 1
        """, where_params)

        rslt['contains_archived_tag'] = bool(self._cr.fetchone())

        return rslt

    def _get_reports_buttons(self):
        res = super(generic_tax_report, self)._get_reports_buttons()
        if self.env.user.has_group('account.group_account_user'):
            res.append({'name': _('Closing Journal Entry'), 'action': 'periodic_tva_entries', 'sequence': 8})
        return res

    def _compute_vat_closing_entry(self, options, raise_on_empty):
        """Compute the VAT closing entry.

        This method returns the one2many commands to balance the tax accounts for the selected period, and
        a dictionnary that will help balance the different accounts set per tax group.
        """
        # first, for each tax group, gather the tax entries per tax and account
        self.env['account.tax'].flush(['name', 'tax_group_id'])
        self.env['account.tax.repartition.line'].flush(['use_in_tax_closing'])
        self.env['account.move.line'].flush(['account_id', 'debit', 'credit', 'move_id', 'tax_line_id', 'date', 'tax_exigible', 'company_id', 'display_type'])
        self.env['account.move'].flush(['state'])
        sql = """
            SELECT "account_move_line".tax_line_id as tax_id,
                    tax.tax_group_id as tax_group_id,
                    tax.name as tax_name,
                    "account_move_line".account_id,
                    COALESCE(SUM("account_move_line".balance), 0) as amount
            FROM account_tax tax, account_tax_repartition_line repartition, %s
            WHERE %s
              AND "account_move_line".tax_exigible
              AND tax.id = "account_move_line".tax_line_id
              AND repartition.id = "account_move_line".tax_repartition_line_id
              AND repartition.use_in_tax_closing
            GROUP BY tax.tax_group_id, "account_move_line".tax_line_id, tax.name, "account_move_line".account_id
        """

        new_options = {
            **options,
            'all_entries': False,
            'date': dict(options['date']),
        }

        period_start, period_end = self.env.company._get_tax_closing_period_boundaries(fields.Date.from_string(options['date']['date_to']))
        new_options['date']['date_from'] = fields.Date.to_string(period_start)
        new_options['date']['date_to'] = fields.Date.to_string(period_end)

        tables, where_clause, where_params = self._query_get(new_options)
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.dictfetchall()
        if not len(results):
            if raise_on_empty:
                raise UserError(_("Nothing to process"))
            else:
                return [], {}

        tax_group_ids = [r['tax_group_id'] for r in results]
        tax_groups = {}
        for tg, result in zip(self.env['account.tax.group'].browse(tax_group_ids), results):
            if tg not in tax_groups:
                tax_groups[tg] = {}
            if result.get('tax_id') not in tax_groups[tg]:
                tax_groups[tg][result.get('tax_id')] = []
            tax_groups[tg][result.get('tax_id')].append((result.get('tax_name'), result.get('account_id'), result.get('amount')))

        # then loop on previous results to
        #    * add the lines that will balance their sum per account
        #    * make the total per tax group's account triplet
        # (if 2 tax groups share the same 3 accounts, they should consolidate in the vat closing entry)
        move_vals_lines = []
        tax_group_subtotal = {}
        currency = self.env.company.currency_id
        for tg, values in tax_groups.items():
            total = 0
            # ignore line that have no property defined on tax group
            if not tg.property_tax_receivable_account_id or not tg.property_tax_payable_account_id:
                continue
            for dummy, value in values.items():
                for v in value:
                    tax_name, account_id, amt = v
                    # Line to balance
                    move_vals_lines.append((0, 0, {'name': tax_name, 'debit': abs(amt) if amt < 0 else 0, 'credit': amt if amt > 0 else 0, 'account_id': account_id}))
                    total += amt

            if not currency.is_zero(total):
                # Add total to correct group
                key = (tg.property_advance_tax_payment_account_id.id or False, tg.property_tax_receivable_account_id.id, tg.property_tax_payable_account_id.id)

                if tax_group_subtotal.get(key):
                    tax_group_subtotal[key] += total
                else:
                    tax_group_subtotal[key] = total
        return move_vals_lines, tax_group_subtotal

    def _add_tax_group_closing_items(self, tax_group_subtotal, end_date):
        """Transform the parameter tax_group_subtotal dictionnary into one2many commands.

        Used to balance the tax group accounts for the creation of the vat closing entry.
        """
        def _add_line(account, name, company_currency):
            self.env.cr.execute(sql_account, (account, end_date))
            result = self.env.cr.dictfetchone()
            advance_balance = result.get('balance') or 0
            # Deduct/Add advance payment
            if not company_currency.is_zero(advance_balance):
                line_ids_vals.append((0, 0, {
                    'name': name,
                    'debit': abs(advance_balance) if advance_balance < 0 else 0,
                    'credit': abs(advance_balance) if advance_balance > 0 else 0,
                    'account_id': account
                }))
            return advance_balance

        currency = self.env.company.currency_id
        sql_account = '''
            SELECT SUM(aml.balance) AS balance
            FROM account_move_line aml
            LEFT JOIN account_move move ON move.id = aml.move_id
            WHERE aml.account_id = %s
              AND aml.date <= %s
              AND move.state = 'posted'
        '''
        line_ids_vals = []
        # keep track of already balanced account, as one can be used in several tax group
        account_already_balanced = []
        for key, value in tax_group_subtotal.items():
            total = value
            # Search if any advance payment done for that configuration
            if key[0] and key[0] not in account_already_balanced:
                total += _add_line(key[0], _('Balance tax advance payment account'), currency)
                account_already_balanced.append(key[0])
            if key[1] and key[1] not in account_already_balanced:
                total += _add_line(key[1], _('Balance tax current account (receivable)'), currency)
                account_already_balanced.append(key[1])
            if key[2] and key[2] not in account_already_balanced:
                total += _add_line(key[2], _('Balance tax current account (payable)'), currency)
                account_already_balanced.append(key[2])
            # Balance on the receivable/payable tax account
            if not currency.is_zero(total):
                line_ids_vals.append((0, 0, {
                    'name': total < 0 and _('Payable tax amount') or _('Receivable tax amount'),
                    'debit': total if total > 0 else 0,
                    'credit': abs(total) if total < 0 else 0,
                    'account_id': key[2] if total < 0 else key[1]
                }))
        return line_ids_vals

    def _find_create_move(self, date_from, date_to, company_id):
        move = self.env['account.move'].search([('tax_closing_end_date', '>=', date_from), ('tax_closing_end_date', '<=', date_to)], limit=1, order='date desc')
        if len(move):
            return move
        else:
            return company_id._create_edit_tax_reminder(date_to, create_when_empty=True)

    def _generate_tax_closing_entry(self, options, move=False, raise_on_empty=False):
        """Generate the VAT closing entry.

        This method is used to automatically post a move for the VAT declaration by doing the following:
        - Search on all taxes line in the given period, group them by tax_group (each tax group might have its own
        tax receivable/payable account).
        - Create a move line that balances each tax account and add the difference in the correct receivable/payable
        account. Also takes into account amount already paid via advance tax payment account.
        """
        on_empty_msg = _('It seems that you have no entries to post, are you sure you correctly configured the accounts on your tax groups?')
        on_empty_action = self.env.ref('account_accountant.action_tax_group')

        # make the preliminary checks
        if options.get('multi_company', False):
            # Ensure that we only have one company selected
            raise UserError(_("You can only post tax entries for one company at a time"))

        company = self.env.company
        if not self.env['account.tax.group']._any_is_configured(company):
            raise RedirectWarning(on_empty_msg, on_empty_action.id, _('Configure your TAX accounts'))

        start_date = fields.Date.from_string(options.get('date').get('date_from'))
        end_date = fields.Date.from_string(options.get('date').get('date_to'))
        if not move:
            move = self._find_create_move(start_date, end_date, company)
        if move.state == 'posted':
            return move
        if company.tax_lock_date and company.tax_lock_date >= end_date:
            raise UserError(_("This period is already closed"))

        # get tax entries by tax_group for the period defined in options
        line_ids_vals, tax_group_subtotal = self._compute_vat_closing_entry(options, raise_on_empty=raise_on_empty)

        # If the tax report is completely empty, we are adding two lines with 0 as values, using the first in in and out
        # account id we find in the tax templates.
        if not len(line_ids_vals):
            tax_out_account_id = self.env['account.tax']\
                .search([('type_tax_use', '=', 'sale'), ('company_id', '=', company.id)], limit=1)\
                .invoice_repartition_line_ids.account_id
            tax_in_account_id = self.env['account.tax']\
                .search([('type_tax_use', '=', 'purchase'), ('company_id', '=', company.id)], limit=1)\
                .invoice_repartition_line_ids.account_id

            if tax_out_account_id and tax_in_account_id:
                line_ids_vals = [(0, 0, {'name': _('Tax Received Adjustment'),
                                         'debit': 0, 'credit': 0.0,
                                         'account_id': tax_out_account_id.id}),
                                 (0, 0, {'name': _('Tax Paid Adjustment'),
                                         'debit': 0.0, 'credit': 0,
                                         'account_id': tax_in_account_id.id})]

        else:
            line_ids_vals += self._add_tax_group_closing_items(tax_group_subtotal, end_date)
        if move.line_ids:
            line_ids_vals += [(2, aml.id) for aml in move.line_ids]
        # create new move
        move_vals = {}
        if len(line_ids_vals):
            move_vals['line_ids'] = line_ids_vals

        move_vals['tax_report_control_error'] = bool(options.get('tax_report_control_error'))
        if options.get('tax_report_control_error'):
            move.message_post(body=options.get('tax_report_control_error'))
        move.write(move_vals)
        return move

    def _get_columns_name(self, options):
        columns_header = [{}]

        if options.get('tax_report') and not options.get('group_by'):
            columns_header.append({'name': '%s \n %s' % (_('Balance'), self.format_date(options)), 'class': 'number', 'style': 'white-space: pre;'})
            if options.get('comparison') and options['comparison'].get('periods'):
                for p in options['comparison']['periods']:
                    columns_header += [{'name': '%s \n %s' % (_('Balance'), p.get('string')), 'class': 'number', 'style': 'white-space: pre;'}]
        else:
            columns_header += [{'name': '%s \n %s' % (_('NET'), self.format_date(options)), 'class': 'number'}, {'name': _('TAX'), 'class': 'number'}]
            if options.get('comparison') and options['comparison'].get('periods'):
                for p in options['comparison']['periods']:
                    columns_header += [{'name': '%s \n %s' % (_('NET'), p.get('string')), 'class': 'number'}, {'name': _('TAX'), 'class': 'number'}]

        return columns_header

    def _get_templates(self):
        # Overridden to add an option to the tax report to display it grouped by tax grid.
        rslt = super(generic_tax_report, self)._get_templates()
        rslt['search_template'] = 'account_reports.search_template_generic_tax_report'
        return rslt

    def _sql_cash_based_taxes(self, group_by_account=False):
        sql = """
            SELECT id, account_id, sum(tax) AS tax, sum(net) AS net FROM (
                SELECT tax.id,
                       %(select_account)s
                       0.0 AS tax,
                       "account_move_line".balance AS net
                  FROM account_move_line_account_tax_rel rel, account_tax tax, {tables}
                 WHERE (tax.tax_exigibility = 'on_payment')
                   AND (rel.account_move_line_id = "account_move_line".id)
                   AND (tax.id = rel.account_tax_id)
                   AND ("account_move_line".tax_exigible)
                   AND {where_clause}

                UNION ALL

                SELECT tax.id,
                       %(select_account)s
                       "account_move_line".balance AS tax,
                       0.0 AS net
                  FROM account_tax tax, {tables}
                 WHERE (tax.tax_exigibility = 'on_payment')
                   AND ("account_move_line".tax_line_id = tax.id)
                   AND ("account_move_line".tax_exigible)
                   AND {where_clause}
            ) cash_based
            GROUP BY id, account_id;
        """
        return sql % {
            'select_account': group_by_account and '"account_move_line".account_id,' or '0 AS account_id,',
        }

    def _sql_tax_amt_regular_taxes(self, group_by_account=False):
        sql = """
            SELECT "account_move_line".tax_line_id,
                   %(select_account)s
                   COALESCE(SUM("account_move_line".balance), 0)
              FROM account_tax tax, {tables}
             WHERE {where_clause}
               AND tax.tax_exigibility = 'on_invoice'
               AND tax.id = "account_move_line".tax_line_id
            GROUP BY "account_move_line".tax_line_id, "account_move_line".account_id
        """
        return sql % {
            'select_account': group_by_account and '"account_move_line".account_id,' or '0 AS account_id,',
        }

    def _sql_net_amt_regular_taxes(self, group_by_account=False):
        sql = '''
            SELECT tax.id,
                   %(select_account)s
                   COALESCE(SUM("account_move_line".balance))
              FROM {tables}
              JOIN account_move_line_account_tax_rel rel ON rel.account_move_line_id = "account_move_line".id
              JOIN account_tax tax ON tax.id = rel.account_tax_id
             WHERE {where_clause}
               AND tax.tax_exigibility = 'on_invoice'
            GROUP BY tax.id, "account_move_line".account_id

            UNION ALL

            SELECT child_tax.id,
                   %(select_account)s
                   COALESCE(SUM("account_move_line".balance))
              FROM {tables}
              JOIN account_move_line_account_tax_rel rel ON rel.account_move_line_id = "account_move_line".id
              JOIN account_tax tax ON tax.id = rel.account_tax_id
              JOIN account_tax_filiation_rel child_rel ON child_rel.parent_tax = tax.id
              JOIN account_tax child_tax ON child_tax.id = child_rel.child_tax
             WHERE {where_clause}
               AND child_tax.tax_exigibility = 'on_invoice'
               AND tax.amount_type = 'group'
               AND child_tax.amount_type != 'group'
            GROUP BY child_tax.id, "account_move_line".account_id
        '''
        return sql % {
            'select_account': group_by_account and '"account_move_line".account_id,' or '0 AS account_id,',
        }

    def _compute_from_amls(self, options, dict_to_fill, period_number):
        """Fill dict_to_fill with the data needed to generate the report."""
        if options.get('tax_report') and not options.get('group_by'):
            self._compute_from_amls_grids(options, dict_to_fill, period_number)
        else:
            self._compute_from_amls_taxes(options, dict_to_fill, period_number)

    def _compute_from_amls_grids(self, options, dict_to_fill, period_number):
        """Fill dict_to_fill with the data needed to generate the report.

        Used when the report is set to group its line by tax grid.
        """
        tables, where_clause, where_params = self._query_get(options)
        sql = """
            SELECT
                   account_tax_report_line_tags_rel.account_tax_report_line_id,
                   SUM(COALESCE(account_move_line.balance, 0)
                       * CASE WHEN acc_tag.tax_negate THEN -1 ELSE 1 END
                       * CASE WHEN account_move.tax_cash_basis_rec_id IS NULL AND
                            account_journal.type = 'sale' AND """ + self._get_not_entry_condition() + """ THEN -1 ELSE 1 END
                       * CASE WHEN """ + self._get_grids_refund_sql_condition() + """ THEN -1 ELSE 1 END
                   ) AS balance
              FROM """ + tables + """
              JOIN account_move
                ON account_move_line.move_id = account_move.id
              JOIN account_account_tag_account_move_line_rel aml_tag
                ON aml_tag.account_move_line_id = account_move_line.id
              JOIN account_journal
                ON account_move.journal_id = account_journal.id
              JOIN account_account_tag acc_tag
                ON aml_tag.account_account_tag_id = acc_tag.id
              JOIN account_tax_report_line_tags_rel
                ON acc_tag.id = account_tax_report_line_tags_rel.account_account_tag_id
              JOIN account_tax_report_line report_line
                ON account_tax_report_line_tags_rel.account_tax_report_line_id = report_line.id
             WHERE """ + where_clause + """
               AND report_line.report_id = %s
               AND account_move_line.tax_exigible
               AND account_journal.id = account_move_line.journal_id
             GROUP BY account_tax_report_line_tags_rel.account_tax_report_line_id
        """

        params = where_params + [options['tax_report']]
        self.env.cr.execute(sql, params)
        for account_tax_report_line_id, balance in self.env.cr.fetchall():
            if account_tax_report_line_id in dict_to_fill:
                dict_to_fill[account_tax_report_line_id][0]['periods'][period_number]['balance'] = balance
                dict_to_fill[account_tax_report_line_id][0]['show'] = True


    def _get_not_entry_condition(self):
        """
        Returns the SQL condition to exclude entry move types
        This function is for example overridden in pos_account_reports.
        """
        return "account_move.move_type != 'entry'"

    def _get_grids_refund_sql_condition(self):
        """ Returns the SQL condition to be used by the tax report's query in order
        to determine whether or not an account.move is a refund.
        This function is for example overridden in pos_account_reports.
        """
        return "account_move.tax_cash_basis_rec_id IS NULL AND account_move.move_type in ('in_refund', 'out_refund')"

    def _compute_from_amls_taxes(self, options, dict_to_fill, period_number):
        """Fill dict_to_fill with the data needed to generate the report.

        Used when the report is set to group its line by tax.
        """
        group_by_account = options.get('group_by')

        sql = self._sql_cash_based_taxes(group_by_account)
        tables, where_clause, where_params = self._query_get(options)
        query = sql.format(tables=tables, where_clause=where_clause)
        self.env.cr.execute(query, where_params + where_params)
        for tax_id, account_id, tax, net in self.env.cr.fetchall():
            if tax_id in dict_to_fill:
                dict_to_fill[tax_id][account_id]['periods'][period_number]['net'] = net
                dict_to_fill[tax_id][account_id]['periods'][period_number]['tax'] = tax
                dict_to_fill[tax_id][account_id]['show'] = True

        # Tax base amount.
        sql = self._sql_net_amt_regular_taxes(group_by_account)
        query = sql.format(tables=tables, where_clause=where_clause)
        self.env.cr.execute(query, where_params + where_params)
        for tax_id, account_id, balance in self.env.cr.fetchall():
            if tax_id in dict_to_fill:
                dict_to_fill[tax_id][account_id]['periods'][period_number]['net'] += balance
                dict_to_fill[tax_id][account_id]['show'] = True

        sql = self._sql_tax_amt_regular_taxes(group_by_account)
        query = sql.format(tables=tables, where_clause=where_clause)
        self.env.cr.execute(query, where_params)
        for tax_line_id, account_id, balance in self.env.cr.fetchall():
            if tax_line_id in dict_to_fill:
                dict_to_fill[tax_line_id][account_id]['periods'][period_number]['tax'] += balance
                dict_to_fill[tax_line_id][account_id]['show'] = True

    def _get_type_tax_use_string(self, value):
        return [
            option.name
            for option in self.env['ir.model.fields']._get('account.tax', 'type_tax_use').selection_ids
            if option.value == value
        ][0]

    @api.model
    def _get_lines(self, options, line_id=None):
        data = self._compute_tax_report_data(options)
        if options.get('tax_report') and not options.get('group_by'):
            return self._get_lines_by_grid(options, line_id, data)
        return self._get_lines_by_tax(options, line_id, data)

    def _get_lines_by_grid(self, options, line_id, grids):
        # Fetch the report layout to use
        report = self.env['account.tax.report'].browse(options['tax_report'])
        formulas_dict = dict(report.line_ids.filtered(lambda l: l.code and l.formula).mapped(lambda l: (l.code, l.formula)))

        # Build the report, line by line
        lines = []
        deferred_total_lines = []  # list of tuples (index where to add the total in lines, tax report line object)
        for current_line in report.get_lines_in_hierarchy():

            hierarchy_level = self._get_hierarchy_level(current_line)

            if current_line.formula:
                # Then it's a total line
                # We defer the adding of total lines, since their balance depends
                # on the rest of the report. We use a special dictionnary for that,
                # keeping track of hierarchy level
                lines.append({'id': 'deferred_total', 'level': hierarchy_level})
                deferred_total_lines.append((len(lines)-1, current_line))
            elif current_line.tag_name:
                # Then it's a tax grid line
                lines.append(self._build_tax_grid_line(grids[current_line.id][0], hierarchy_level))
            else:
                # Then it's a title line
                lines.append(self._build_tax_section_line(current_line, hierarchy_level))

        # Fill in in the total for each title line and get a mapping linking line codes to balances
        balances_by_code = self._postprocess_lines(lines, options)
        for (index, total_line) in deferred_total_lines:
            hierarchy_level = self._get_hierarchy_level(total_line)
            # number_period option contains 1 if no comparison, or the number of periods to compare with if there is one.
            total_period_number = 1 + (options['comparison'].get('periods') and options['comparison']['number_period'] or 0)
            lines[index] = self._build_total_line(total_line, balances_by_code, formulas_dict, hierarchy_level, total_period_number, options)

        return lines

    def _get_hierarchy_level(self, report_line):
        """Return the hierarchy level to be used by a tax report line, depending on its parents.

        A line with no parent will have a hierarchy of 1.
        A line with n parents will have a hierarchy of 2n+1.
        """
        return 1 + 2 * (len(report_line.parent_path[:-1].split('/')) - 1)

    def _postprocess_lines(self, lines, options):
        """Postprocess the report line dictionaries generated for a grouped by tax grid report.

        Used in order to compute the balance of each of its non-total sections.

        :param lines: The list of dictionnaries conaining all the line data generated for this report.
                      Title lines will be modified in place to have a balance corresponding to the sum
                      of their children's

        :param options: The dictionary of options used to buld the report.

        :return: A dictionary mapping the line codes defined in this report to the corresponding balances.
        """
        balances_by_code = {}
        totals_by_line = {}
        active_sections_stack = []
        col_nber = len(options['comparison']['periods']) + 1

        def assign_active_section(col_nber):
            line_to_assign = active_sections_stack.pop()
            total_balance_col = totals_by_line.get(line_to_assign['id'], [0] * col_nber)
            line_to_assign['columns'] = [{'name': self.format_value(balance), 'style': 'white-space:nowrap;', 'balance': balance} for balance in total_balance_col]

            if line_to_assign.get('line_code'):
                balances_by_code[line_to_assign['line_code']] = total_balance_col

        for line in lines:
            while active_sections_stack and line['level'] <= active_sections_stack[-1]['level']:
                assign_active_section(col_nber)

            if line['id'] == 'deferred_total':
                pass
            elif str(line['id']).startswith('section_'):
                active_sections_stack.append(line)
            else:
                if line.get('line_code'):
                    balances_by_code[line['line_code']] = [col['balance'] for col in line['columns']]

                if active_sections_stack:
                    for active_section in active_sections_stack:
                        line_balances = [col['balance'] for col in line['columns']]
                        rslt_balances = totals_by_line.get(active_section['id'])
                        totals_by_line[active_section['id']] = line_balances if not rslt_balances else [line_balances[i] + rslt_balances[i] for i in range(0, len(rslt_balances))]

        self.compute_check(lines, options)

        # Treat the last sections (the one that were not followed by a line with lower level)
        while active_sections_stack:
            assign_active_section(col_nber)

        return balances_by_code

    def compute_check(self, lines, options):
        """Apply the check process defined for the currently displayed tax report, if there is any.

        This function must only be called if the tax_report
        option is used.
        """
        tax_report = self.env['account.tax.report'].browse(options['tax_report'])

        col_nber = len(options['comparison']['periods']) + 1
        mapping = {}
        controls = []
        html_lines = []
        for line in lines:
            if line.get('line_code'):
                mapping[line['line_code']] = line['columns'][0]['balance']
        for i, calc in enumerate(tax_report.get_checks_to_perform(mapping)):
            if calc[1]:
                if isinstance(calc[1], float):
                    value = self.format_value(calc[1])
                else:
                    value = calc[1]
                controls.append({'name': calc[0], 'id': 'control_' + str(i), 'columns': [{'name': value, 'style': 'white-space:nowrap;', 'balance': calc[1]}]})
                html_lines.append("<tr><td>{name}</td><td>{amount}</td></tr>".format(name=calc[0], amount=value))
        if controls:
            lines.extend([{'id': 'section_control', 'name': _('Controls failed'), 'unfoldable': False, 'columns': [{'name': '', 'style': 'white-space:nowrap;', 'balance': ''}] * col_nber, 'level': 0, 'line_code': False}] + controls)
            options['tax_report_control_error'] = "<table width='100%'><tr><th>Control</th><th>Difference</th></tr>{}</table>".format("".join(html_lines))

    def _get_total_line_eval_dict(self, period_balances_by_code, period_date_from, period_date_to, options):
        """Return period_balances_by_code.

        By default, this function only returns period_balances_by_code; but it
        is meant to be overridden in the few situations where we need to evaluate
        something we cannot compute with only tax report line codes.
        """
        return period_balances_by_code

    def _build_total_line(self, report_line, balances_by_code, formulas_dict, hierarchy_level, number_periods, options):
        """Return the report line dictionary corresponding to a given total line.

        Compute if from its formula.
        """
        def expand_formula(formula):
            for word in re.split(r'\W+', formula):
                if formulas_dict.get(word):
                    formula = re.sub(r'\b%s\b' % word, '(%s)' % expand_formula(formulas_dict.get(word)), formula)
            return formula

        columns = []
        for period_index in range(0, number_periods):
            period_balances_by_code = {code: balances[period_index] for code, balances in balances_by_code.items()}
            period_date_from = (period_index == 0) and options['date']['date_from'] or options['comparison']['periods'][period_index-1]['date_from']
            period_date_to = (period_index == 0) and options['date']['date_to'] or options['comparison']['periods'][period_index-1]['date_to']

            eval_dict = self._get_total_line_eval_dict(period_balances_by_code, period_date_from, period_date_to, options)
            period_total = safe_eval.safe_eval(expand_formula(report_line.formula), eval_dict)
            columns.append({'name': '' if period_total is None else self.format_value(period_total), 'style': 'white-space:nowrap;', 'balance': period_total or 0.0})

        return {
            'id': 'total_' + str(report_line.id),
            'name': report_line.name,
            'unfoldable': False,
            'columns': columns,
            'level': hierarchy_level,
            'line_code': report_line.code
        }

    def _build_tax_section_line(self, section, hierarchy_level):
        """Return the report line dictionary corresponding to a given section.

        Used when grouping the report by tax grid.
        """
        return {
            'id': 'section_' + str(section.id),
            'name': section.name,
            'unfoldable': False,
            'columns': [],
            'level': hierarchy_level,
            'line_code': section.code,
        }

    def _build_tax_grid_line(self, grid_data, hierarchy_level):
        """Return the report line dictionary corresponding to a given tax grid.

        Used when grouping the report by tax grid.
        """
        columns = []
        for period in grid_data['periods']:
            columns += [{'name': self.format_value(period['balance']), 'style': 'white-space:nowrap;', 'balance': period['balance']}]

        rslt = {
            'id': grid_data['obj'].id,
            'name': grid_data['obj'].name,
            'unfoldable': False,
            'columns': columns,
            'level': hierarchy_level,
            'line_code': grid_data['obj'].code,
        }

        if grid_data['obj'].report_action_id:
            rslt['action_id'] = grid_data['obj'].report_action_id.id
        else:
            rslt['caret_options'] = 'account.tax.report.line'

        return rslt

    def _get_lines_by_tax(self, options, line_id, taxes):
        def get_name_from_record(record):
            format = '%(name)s - %(company)s' if options.get('multi_company') else '%(name)s'
            params = {'company': record.company_id.name}
            if record._name == 'account.tax':
                if record.amount_type == 'group':
                    params['name'] = record.name
                else:
                    params['name'] = '%s (%s)' % (record.name, record.amount)
            elif record._name == 'account.account':
                params['name'] = record.display_name
            return format % params

        def get_vals_from_tax_and_add(tax, *total_lines):
            net_vals = [period['net'] * sign for period in tax['periods']]
            tax_vals = [
                sum(vals['amount'] for vals in tax['obj'].compute_all(period['net'], handle_price_include=False)['taxes']) * sign
                if group_by else
                (period['tax'] * sign)
                for period in tax['periods']
            ]
            if group_by and tax['obj'].amount_type == 'group':
                raise UserError(_('Tax report groupped by account is not available for taxes of type Group'))
            all_vals = list(chain.from_iterable(zip(net_vals, tax_vals)))
            show = any(bool(n) for n in all_vals)

            if show:
                for total in total_lines:
                    if total:
                        for i, v in enumerate(all_vals):
                            total['columns'][i]['no_format'] += v

            return all_vals, show

        group_by = options.get('group_by')
        lines = []
        types = ['sale', 'purchase']
        accounts = self.env['account.account']
        groups = dict((tp, defaultdict(lambda: {})) for tp in types)
        for tax_account in taxes.values():
            for account_id, tax in tax_account.items():
                # 'none' taxes are skipped.
                if tax['obj'].type_tax_use == 'none':
                    continue

                if tax['obj'].amount_type == 'group':
                    # Group of taxes without child are skipped.
                    if not tax['obj'].children_tax_ids:
                        continue

                    # - If at least one children is 'none', show the group of taxes.
                    # - If all children are different of 'none', only show the children.
                    tax['children'] = []
                    tax['show'] = False
                    for child in tax['obj'].children_tax_ids:
                        if child.type_tax_use != 'none':
                            continue

                        tax['show'] = True
                        for i, period_vals in enumerate(taxes[child.id][0]['periods']):
                            tax['periods'][i]['tax'] += period_vals['tax']
                account = self.env['account.account'].browse(account_id)
                accounts += account
                if group_by == 'tax_account':
                    groups[tax['obj'].type_tax_use][tax['obj']][account] = tax
                else:
                    groups[tax['obj'].type_tax_use][account][tax['obj']] = tax

        accounts.mapped('display_name')  # prefetch values

        period_number = len(options['comparison'].get('periods'))
        for tp in types:
            if not any(tax.get('show') for group in groups[tp].values() for tax in group.values()):
                continue
            sign = tp == 'sale' and -1 or 1
            type_line = {
                'id': tp,
                'name': self._get_type_tax_use_string(tp),
                'unfoldable': False,
                'columns': [{'no_format': 0} for k in range(0, 2 * (period_number + 1))],
                'level': 1,
            }
            lines.append(type_line)
            for header_level_1, group_level_1 in groups[tp].items():
                header_level_1_line = False
                if header_level_1:
                    header_level_1_line = {
                        'id': header_level_1.id,
                        'name': get_name_from_record(header_level_1),
                        'unfoldable': False,
                        'columns': [{'no_format': 0} for k in range(0, 2 * (period_number + 1))],
                        'level': 2,
                        'caret_options': header_level_1._name
                    }
                    lines.append(header_level_1_line)
                for header_level_2, group_level_2 in sorted(group_level_1.items(), key=lambda g: g[1]['obj'].sequence):
                    if group_level_2['show']:
                        all_vals, show = get_vals_from_tax_and_add(group_level_2, type_line, header_level_1_line)
                        if show:
                            lines.append({
                                'id': header_level_2.id,
                                'name': get_name_from_record(header_level_2),
                                'unfoldable': False,
                                'columns': [{'no_format': v, 'style': 'white-space:nowrap;'} for v in all_vals],
                                'level': 4,
                                'caret_options': header_level_2._name,
                            })
                        for child in group_level_2.get('children', []):
                            all_vals, show = get_vals_from_tax_and_add(child, type_line, header_level_1_line)
                            if show:
                                lines.append({
                                    'id': child['obj'].id,
                                    'name': '   ' + get_name_from_record(child['obj']),
                                    'unfoldable': False,
                                    'columns': [{'no_format': v, 'style': 'white-space:nowrap;'} for v in all_vals],
                                    'level': 4,
                                    'caret_options': 'account.tax',
                                })
                if lines[-1] == header_level_1_line:
                    del lines[-1]  # No children so we remove the total line
            if lines[-1] == type_line:
                del lines[-1]  # No children so we remove the total line
        for line in lines:
            for column in line['columns']:
                column['name'] = self.format_value(column['no_format'])
        return lines

    @api.model
    def _get_tax_report_data_prefill_record(self, options):
        """Generate records to prefill tax report data, depending on the selected options.

        (use of generic report or not). This function yields account.tax.report.line
        objects if the options required the use of a tax report template (account.tax.report) ;
        else, it yields account.tax records.
        """
        if options.get('tax_report') and not options.get('group_by'):
            for line in self.env['account.tax.report'].browse(options['tax_report']).line_ids:
                yield line
        else:
            company_term = self.env.companies.ids if options.get('multi_company') else self.env.company.ids
            for tax in self.env['account.tax'].with_context(active_test=False).search([('company_id', 'in', company_term)]):
                yield tax

    @api.model
    def _compute_tax_report_data(self, options):
        rslt = {}
        empty_data_dict = {'balance': 0} if options.get('tax_report') and not options.get('group_by') else {'net': 0, 'tax': 0}
        for record in self._get_tax_report_data_prefill_record(options):
            rslt[record.id] = defaultdict(lambda record=record: {
                'obj': record,
                'show': False,
                'periods': [empty_data_dict.copy() for i in range(len(options['comparison'].get('periods')) + 1)]
            })

        for period_number, period_options in enumerate(self._get_options_periods_list(options)):
            self._compute_from_amls(period_options, rslt, period_number)

        return rslt

    @api.model
    def _get_report_name(self):
        return _('Tax Report')

    def _get_amls_with_archived_tags_domain(self, previous_options=None):
        options = super(generic_tax_report, self)._get_options(previous_options)
        return [
            ('tax_tag_ids.active', '=', False),
            ('parent_state', '=', 'posted'),
            ('date', '>=', options['date']['date_from']),
            ('date', '<=', options['date']['date_to']),
        ]

    def action_archived_tag_move(self, options, params=None):
        return {
            'name': _("Journal items with archived tax tags"),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move.line',
            'domain': self._get_amls_with_archived_tags_domain(options),
            'context': {'active_test': False},
            'views': [(self.env.ref('account_reports.view_archived_tag_move_tree').id, 'list')],
        }
