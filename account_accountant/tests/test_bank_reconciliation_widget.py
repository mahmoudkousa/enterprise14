# -*- coding: utf-8 -*-
from freezegun import freeze_time

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestBankStatementReconciliation(AccountTestInvoicingCommon):

    def test_reconciliation_proposition(self):
        move = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_line_ids': [(0, 0, {
                'quantity': 1,
                'price_unit': 100,
                'name': 'test invoice',
            })],
        })
        move.action_post()
        rcv_mv_line = move.line_ids.filtered(lambda line: line.account_id.user_type_id.type in ('receivable', 'payable'))

        st_line = self.env['account.bank.statement'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'line_ids': [(0, 0, {
                'payment_ref': '_',
                'partner_id': self.partner_a.id,
                'amount': 100,
            })],
        }).line_ids

        # exact amount match
        rec_prop = self.env['account.reconciliation.widget'].get_bank_statement_line_data(st_line.ids)['lines']
        prop = rec_prop[0]['reconciliation_proposition']

        self.assertEqual(len(prop), 1)
        self.assertEqual(prop[0]['id'], rcv_mv_line.id)

    @freeze_time('2017-01-01')
    def test_reconciliation_writeoff_suggestion(self):
        self.env['account.reconcile.model'].create({
            'name': 'write-off model',
            'rule_type': 'writeoff_suggestion',
            'match_partner': False,
            'match_partner_ids': [],
            'line_ids': [(0, 0, {'account_id': self.company_data['default_account_assets'].id})],
        })

        st_line = self.env['account.bank.statement'].create({
            'journal_id': self.company_data['default_journal_bank'].id,
            'line_ids': [(0, 0, {
                'payment_ref': '_',
                'partner_id': self.partner_a.id,
                'amount': 50,
                'amount_currency': 100,
                'foreign_currency_id': self.currency_data['currency'].id
            })],
        }).line_ids

        # exact amount match
        rec_prop = self.env['account.reconciliation.widget'].get_bank_statement_line_data(st_line.ids)['lines']
        writeoff_vals = rec_prop[0]['write_off_vals']

        self.assertEqual(len(writeoff_vals), 1)
        self.assertEqual(writeoff_vals[0]['balance'], -st_line['amount_currency'])

    @freeze_time('2017-01-01')
    def test_reconciliation_write_off_with_tax_tags(self):
        bank_journal_foreign_curr = self.company_data['default_journal_bank'].copy({'currency_id': self.currency_data['currency'].id})
        country = self.env.ref('base.us')
        tax_report = self.env['account.tax.report'].create({
            'name': "Tax report",
            'country_id': country.id,
        })
        tax_report_line = self.env['account.tax.report.line'].create({
            'name': 'test_tax_report_line',
            'tag_name': 'test_tax_report_line',
            'report_id': tax_report.id,
            'sequence': 10,
        })
        tax_tag_pos = tax_report_line.tag_ids.filtered(lambda x: not x.tax_negate)
        tax_tag_neg = tax_report_line.tag_ids.filtered(lambda x: x.tax_negate)
        tax = self.env['account.tax'].create({
            'name': 'Test Tax',
            'amount_type': 'percent',
            'amount': 10,
            'invoice_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'tag_ids': [(6, 0, tax_tag_pos.ids)],
                }),
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'tag_ids': [(6, 0, tax_tag_neg.ids)],
                }),
            ],
            'refund_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'tag_ids': [(6, 0, tax_tag_neg.ids)],
                }),
                (0, 0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'tag_ids': [(6, 0, tax_tag_pos.ids)],
                }),
            ],
        })

        self.env['account.reconcile.model'].search([('company_id', '=', self.company_data_2['company'].id), ('rule_type', '=', 'invoice_matching')]).write({
            'name': 'Invoices Matching Rule',
            'sequence': '1',
            'rule_type': 'invoice_matching',
            'auto_reconcile': False,
            'match_nature': 'both',
            'match_journal_ids': bank_journal_foreign_curr.ids,
            'match_same_currency': True,
            'match_total_amount': True,
            'match_total_amount_param': 90,
            'match_text_location_label': True,
            'company_id': self.company_data['company'].id,
            'line_ids': [(0, 0, {
                'account_id': self.company_data['default_account_assets'].id,
                'amount_type': 'percentage',
                'amount': 100,
                'tax_ids': [(6, 0, tax.ids)],
            })],
        })

        move = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [(0, 0, {
                'quantity': 1,
                'price_unit': 100,
                'name': 'test invoice',
            })],
        })
        move.action_post()

        st_line = self.env['account.bank.statement'].create({
            'journal_id': bank_journal_foreign_curr.id,
            'line_ids': [(0, 0, {
                'payment_ref': move.payment_reference,
                'partner_id': self.partner_a.id,
                'amount': 90,
            })],
        }).line_ids

        rec_prop = self.env['account.reconciliation.widget'].get_bank_statement_line_data(st_line.ids)['lines']
        writeoff_vals = rec_prop[0]['write_off_vals']

        self.assertEqual(len(writeoff_vals), 2, "Two write off line (base + tax) should be present")
        expected_write_off = {
            'balance': 10.0,
            'tax_ids': [{'display_name': tax.name, 'id': tax.id}],
            'tax_tag_ids': [{'display_name': tax_tag_neg.name, 'id': tax_tag_neg.id}],
        }
        to_compare = {
            key: writeoff_vals[0][key] for key in expected_write_off
        }

        self.assertDictEqual(expected_write_off, to_compare)

    @freeze_time('2017-01-01')
    def test_reconciliation_partial_matching_rule(self):
        bank_journal_foreign_curr = self.company_data['default_journal_bank'].copy({'currency_id': self.currency_data['currency'].id})

        self.env['account.reconcile.model'].search([('company_id', '=', self.company_data_2['company'].id), ('rule_type', '=', 'invoice_matching')]).write({
            'name': 'Invoices Matching Rule',
            'sequence': '1',
            'rule_type': 'invoice_matching',
            'auto_reconcile': False,
            'match_nature': 'both',
            'match_journal_ids': bank_journal_foreign_curr.ids,
            'match_same_currency': True,
            'match_total_amount': True,
            'match_total_amount_param': 90,
            'match_text_location_label': True,
            'company_id': bank_journal_foreign_curr.company_id.id,
            'line_ids': [(0, 0, {
                'account_id': self.company_data['default_account_assets'].id,
                'amount_type': 'percentage',
                'amount': 100
            })],
        })

        move = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [(0, 0, {
                'quantity': 1,
                'price_unit': 100,
                'name': 'test invoice',
            })],
        })
        move.action_post()

        st_line = self.env['account.bank.statement'].create({
            'journal_id': bank_journal_foreign_curr.id,
            'line_ids': [(0, 0, {
                'payment_ref': move.payment_reference,
                'partner_id': self.partner_a.id,
                'amount': 90,
            })],
        }).line_ids

        rec_prop = self.env['account.reconciliation.widget'].get_bank_statement_line_data(st_line.ids)['lines']
        writeoff_vals = rec_prop[0]['write_off_vals']

        self.assertEqual(len(writeoff_vals), 1)
        self.assertEqual(writeoff_vals[0]['balance'], move.invoice_line_ids[0]['price_unit'] - st_line['amount'])
