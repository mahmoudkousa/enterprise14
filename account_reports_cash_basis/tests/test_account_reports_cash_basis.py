# -*- coding: utf-8 -*-
from odoo import fields
from odoo.tests import tagged
from odoo import fields

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon


@tagged('post_install', '-at_install')
class TestAccountReports(TestAccountReportsCommon):

    @classmethod
    def _reconcile_on(cls, lines, account):
        lines.filtered(lambda line: line.account_id == account and not line.reconciled).reconcile()

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.liquidity_journal_1 = cls.company_data['default_journal_bank']
        cls.liquidity_account = cls.liquidity_journal_1.default_account_id
        cls.receivable_account_1 = cls.company_data['default_account_receivable']
        cls.revenue_account_1 = cls.company_data['default_account_revenue']

        # Invoice having two receivable lines on the same account.

        invoice = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'journal_id': cls.company_data['default_journal_misc'].id,
            'line_ids': [
                (0, 0, {'debit': 345.0,     'credit': 0.0,      'account_id': cls.receivable_account_1.id}),
                (0, 0, {'debit': 805.0,     'credit': 0.0,      'account_id': cls.receivable_account_1.id}),
                (0, 0, {'debit': 0.0,       'credit': 1150.0,   'account_id': cls.revenue_account_1.id}),
            ],
        })
        invoice.action_post()

        # First payment (20% of the invoice).

        payment_1 = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-02-01',
            'journal_id': cls.liquidity_journal_1.id,
            'line_ids': [
                (0, 0, {'debit': 0.0,       'credit': 230.0,    'account_id': cls.receivable_account_1.id}),
                (0, 0, {'debit': 230.0,     'credit': 0.0,      'account_id': cls.liquidity_account.id}),
            ],
        })
        payment_1.action_post()

        cls._reconcile_on((invoice + payment_1).line_ids, cls.receivable_account_1)

        # Second payment (also 20% but will produce two partials, one on each receivable line).

        payment_2 = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-03-01',
            'journal_id': cls.liquidity_journal_1.id,
            'line_ids': [
                (0, 0, {'debit': 0.0,       'credit': 230.0,    'account_id': cls.receivable_account_1.id}),
                (0, 0, {'debit': 230.0,     'credit': 0.0,      'account_id': cls.liquidity_account.id}),
            ],
        })
        payment_2.action_post()

        cls._reconcile_on((invoice + payment_2).line_ids, cls.receivable_account_1)

    def test_general_ledger_cash_basis(self):
        # Check the cash basis option.
        report = self.env['account.general.ledger']
        options = self._init_options(report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'))
        options['cash_basis'] = True

        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Name                            Debit       Credit      Balance
            [   0,                              4,          5,          6],
            [
                # Accounts.
                ('101402 Bank',                 460.0,      0.0,        460.0),
                ('121000 Account Receivable',   460.0,      460.0,      0.0),
                ('400000 Product Sales',        0.0,        460.0,      -460.0),
                # Report Total.
                ('Total',                       920.0,      920.0,     0.0),
            ],
        )

        # Mark the '101200 Account Receivable' line to be unfolded.
        line_id = lines[1]['id']
        options['unfolded_lines'] = [line_id]
        options['cash_basis'] = False  # Because we are in the same transaction, the table temp_account_move_line still exists
        self.assertLinesValues(
            report._get_lines(options, line_id=line_id),
            #   Name                                    Date            Debit           Credit          Balance
            [   0,                                      1,              4,              5,              6],
            [
                # Account.
                ('121000 Account Receivable',           '',             1610.0,         920.0,          690.0),
                ('Initial Balance',                     '',             0.0,            0.0,            0.0),
                # Account Move Lines.
                ('MISC/2016/01/0001',                   '01/01/2016',   345.0,          '',             345.0),
                ('MISC/2016/01/0001',                   '01/01/2016',   805,            '',             1150.0),
                ('MISC/2016/01/0001',                   '02/01/2016',   69.0,           '',             1219.0),
                ('MISC/2016/01/0001',                   '02/01/2016',   161.0,          '',             1380.0),
                ('BNK1/2016/02/0001',                   '02/01/2016',   '',             230.0,          1150.0),
                ('BNK1/2016/02/0001',                   '02/01/2016',   '',             230.0,          920.0),
                ('MISC/2016/01/0001',                   '03/01/2016',   34.5,           '',             954.5),
                ('MISC/2016/01/0001',                   '03/01/2016',   34.5,           '',             989.0),
                ('MISC/2016/01/0001',                   '03/01/2016',   80.5,           '',             1069.5),
                ('MISC/2016/01/0001',                   '03/01/2016',   80.5,           '',             1150.0),
                ('BNK1/2016/03/0001',                   '03/01/2016',   '',             230.0,          920.0),
                ('BNK1/2016/03/0001',                   '03/01/2016',   '',             230.0,          690.0),
                # Account Total.
                ('Total 121000 Account Receivable',     '',             1610.0,         920.0,          690.0),
            ],
        )

    def test_balance_sheet_cash_basis(self):
        # Check the cash basis option.
        report = self.env.ref('account_reports.account_financial_report_balancesheet0')
        options = self._init_options(report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'))
        options['cash_basis'] = True

        self.assertLinesValues(
            report._get_table(options)[1],
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('ASSETS',                                      460.0),
                ('Current Assets',                              460.0),
                ('Bank and Cash Accounts',                      460.0),
                ('Receivables',                                 0.0),
                ('Current Assets',                              0.0),
                ('Prepayments',                                 0.0),
                ('Total Current Assets',                        460.0),
                ('Plus Fixed Assets',                           0.0),
                ('Plus Non-current Assets',                     0.0),
                ('Total ASSETS',                                460.0),

                ('LIABILITIES',                                 0.0),
                ('Current Liabilities',                         0.0),
                ('Current Liabilities',                         0.0),
                ('Payables',                                    0.0),
                ('Total Current Liabilities',                   0.0),
                ('Plus Non-current Liabilities',                0.0),
                ('Total LIABILITIES',                           0.0),

                ('EQUITY',                                      460.0),
                ('Unallocated Earnings',                        460.0),
                ('Current Year Unallocated Earnings',           460.0),
                ('Current Year Earnings',                       460.0),
                ('Current Year Allocated Earnings',             0.0),
                ('Total Current Year Unallocated Earnings',     460.0),
                ('Previous Years Unallocated Earnings',         0.0),
                ('Total Unallocated Earnings',                  460.0),
                ('Retained Earnings',                           0.0),
                ('Total EQUITY',                                460.0),

                ('LIABILITIES + EQUITY',                        460.0),
            ],
        )

    def test_cash_basis_payment_in_the_past(self):
        payment_date = fields.Date.from_string('2010-01-01')
        invoice_date = fields.Date.from_string('2011-01-01')

        invoice = self.init_invoice('out_invoice', amounts=[100.0], partner=self.partner_a, invoice_date=invoice_date, post=True)
        self.env['account.payment.register'].with_context(active_ids=invoice.ids, active_model='account.move').create({
            'payment_date': payment_date,
        })._create_payments()

        # Check the impact in the reports: the invoice date should be the one the invoice appears at, since it greater than the payment's
        report = self.env['account.general.ledger']

        options = self._init_options(report, payment_date, payment_date)
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            # pylint: disable=C0326
            report._get_lines(options),
            #   Name                                     Debit           Credit          Balance
            [   0,                                       4,              5,              6],
            [
                # Accounts.
                ('101403 Outstanding Receipts',        115,              0,            115),
                ('121000 Account Receivable',            0,            115,           -115),
                # Report Total.
                ('Total',                              115,            115,              0),
            ],
        )

        # Delete the temporary cash basis table manually in order to run another _get_lines in the same transaction
        self.env.cr.execute("""
            DROP TABLE temp_account_move_line
        """)

        options = self._init_options(report, invoice_date, invoice_date)
        options['cash_basis'] = True
        report = report.with_context(report._set_context(options))

        self.assertLinesValues(
            # pylint: disable=C0326
            report._get_lines(options),
            #   Name                                     Debit           Credit          Balance
            [   0,                                       4,              5,              6],
            [
                # Accounts.
                ('101403 Outstanding Receipts',        115,              0,            115),
                ('121000 Account Receivable',          115,            115,              0),
                ('251000 Tax Received',                  0,             15,            -15),
                ('400000 Product Sales',                 0,            100,           -100),
                # Report Total.
                ('Total',                              230,            230,              0),
            ],
        )
