# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo import fields


@tagged('post_install', '-at_install')
class TestSyncStatementCreation(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.bnk_stmt = cls.env['account.bank.statement']

        # Create an account.online.provider and account.online.journal and associate to journal bank
        cls.bank_journal = cls.env['account.journal'].create({'name': 'Bank_Online', 'type': 'bank', 'code': 'BNKonl', 'currency_id': cls.env.ref('base.EUR').id})
        cls.provider_account = cls.env['account.online.provider'].create({'name': 'Test Bank'})
        cls.online_account = cls.env['account.online.journal'].create({
            'name': 'MyBankAccount',
            'account_online_provider_id': cls.provider_account.id,
            'journal_ids': [(6, 0, [cls.bank_journal.id])]
        })
        cls.transaction_id = 1
        cls.account = cls.company_data['default_account_assets']

    # This method return a list of transactions with the given dates
    # amount for each transactions is 10
    def create_transactions(self, dates):
        transactions = []
        for date in dates:
            transactions.append({
                'online_identifier': self.transaction_id,
                'date': fields.Date.from_string(date),
                'payment_ref': 'transaction_' + str(self.transaction_id),
                'amount': 10,
            })
            self.transaction_id += 1
        return transactions


    def create_transaction_partner(self, date=False, partner_id=False, vendor_name=False, account_number=False):
        tr = {
            'online_identifier': self.transaction_id,
            'date': fields.Date.from_string(date),
            'payment_ref': 'transaction_p',
            'amount': 50,
        }
        if partner_id:
            tr['partner_id'] = partner_id
        if vendor_name:
            tr['online_partner_vendor_name'] = vendor_name
        if account_number:
            tr['online_partner_bank_account'] = account_number
        self.transaction_id += 1
        return [tr]

    def assertDate(self, date1, date2):
        if isinstance(date1, str):
            date1 = fields.Date.from_string(date1)
        if isinstance(date2, str):
            date2 = fields.Date.from_string(date2)
        self.assertEqual(date1, date2)

    def confirm_bank_statement(self, statement):
        for line in statement.line_ids:
            liquidity_lines, suspense_lines, other_lines = line._seek_for_lines()
            line.reconcile([{
                'name': 'toto',
                'account_id': self.account.id,
                'balance': sum(suspense_lines.mapped('balance')),
                'currency_id': False,
            }])
        statement.button_validate()
        return statement

    def test_creation_initial_sync_statement(self):
        transactions = self.create_transactions(['2016-01-01', '2016-01-03'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 1000)
        # Since ending balance is 1000$ and we only have 20$ of transactions and that it is the first statement
        # it should create a statement before this one with the initial statement line
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 2, 'Should have created an initial bank statement and one for the synchronization')
        self.assertEqual(created_bnk_stmt[0].balance_start, 0)
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 980)
        self.assertDate(created_bnk_stmt[0].date, '2015-12-31')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 1, 'Should only have one line')

        self.assertEqual(created_bnk_stmt[1].balance_start, 980)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 1000)
        self.assertDate(created_bnk_stmt[1].date, '2016-01-03')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 2, 'Should have two lines')
        self.assertEqual(created_bnk_stmt[1].line_ids[0].amount, 10)
        self.assertEqual(created_bnk_stmt[1].line_ids[1].amount, 10)

        # Since a statement already exists, next transactions should not create an initial statement even if ending_balance
        # is greater than the sum of transactions
        transactions = self.create_transactions(['2016-01-05'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 2000)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 3, 'Should not have created an initial bank statement')
        self.assertEqual(created_bnk_stmt[2].balance_start, 1000)
        self.assertEqual(created_bnk_stmt[2].balance_end_real, 2000)
        self.assertDate(created_bnk_stmt[2].date, '2016-01-05')
        self.assertEqual(len(created_bnk_stmt[2].line_ids), 1, 'Should only have one line')
        self.assertEqual(created_bnk_stmt[2].line_ids.amount, 10)

    def test_creation_initial_sync_statement_bis(self):
        transactions = self.create_transactions(['2016-01-01', '2016-01-03'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 20)
        # Since ending balance is 20$ and we only have 20$ of transactions and that it is the first statement
        # it should NOT create a initial statement before this one
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 1, 'Should NOT have created an initial bank statement')
        self.assertEqual(created_bnk_stmt[0].balance_start, 0)
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 20)
        self.assertDate(created_bnk_stmt[0].date, '2016-01-03')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 2, 'Should have two lines')

    def test_creation_every_sync(self):
        # Create one statement with 2 lines
        transactions = self.create_transactions(['2016-01-01', '2016-01-03'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 20)
        # Create another statement with 2 lines
        transactions = self.create_transactions(['2016-01-02', '2016-01-05'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 40)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 2, 'Should have created two different bank statements')
        self.assertDate(created_bnk_stmt[0].date, '2016-01-03')
        self.assertEqual(created_bnk_stmt[0].name, 'Online synchronization of 2016-01-03')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-05')
        self.assertEqual(created_bnk_stmt[1].name, 'Online synchronization of 2016-01-05')
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 40)

        # If we create a statement with a transactions max date in the past, it will be created in the past
        # Also the account balance will be set on the last statement
        transactions = self.create_transactions(['2016-01-04'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 70)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 3, 'Should have created three different bank statements')
        self.assertDate(created_bnk_stmt[0].date, '2016-01-03')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-04')
        self.assertDate(created_bnk_stmt[2].date, '2016-01-05')
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 30)
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 1, 'Should only have one line')
        # Check that balance is correctly written on last statement
        self.assertEqual(created_bnk_stmt[2].balance_end_real, 70)

        # If we create a statement with a transactions max date in the past, and that a statement at that date
        # already exists, it will be added to that statement
        transactions = self.create_transactions(['2016-01-04', '2016-01-04'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 70)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 3, 'Should have not created any new bank statements')
        self.assertDate(created_bnk_stmt[0].date, '2016-01-03')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-04')
        self.assertDate(created_bnk_stmt[2].date, '2016-01-05')
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 50)
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 3, 'Should have added two lines to it')
        self.assertEqual(created_bnk_stmt[2].balance_end_real, 70)


    def test_creation_every_day(self):
        self.bank_journal.write({'bank_statement_creation': 'day'})
        transactions = self.create_transactions(['2016-01-10', '2016-01-15'])
        # first synchronization, no previous bank statement
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 20)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 2, 'Should have created two bank statements, one for each transaction')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 1, 'bank statement should have 1 line ')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 1, 'bank statement should have 1 line ')
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 10)
        self.assertEqual(created_bnk_stmt[1].balance_start, 10)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 20)
        self.assertDate(created_bnk_stmt[0].date, '2016-01-10')
        self.assertEqual(created_bnk_stmt[0].name, 'Online synchronization of 2016-01-10')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-15')
        self.assertEqual(created_bnk_stmt[1].name, 'Online synchronization of 2016-01-15')

        # Fetch new transactions, two will be added to already existing statement, two will create new statements in between
        # and one will create new statements afterwards
        transactions = self.create_transactions(['2016-01-10', '2016-01-10', '2016-01-12', '2016-01-13', '2016-01-16'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 70)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 5, 'Should have created a total of 5 bank statements')
        self.assertDate(created_bnk_stmt[0].date, '2016-01-10')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 3, '3 lines should have been added to first statement')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-12')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 1, 'new statement should only have one line')
        self.assertDate(created_bnk_stmt[2].date, '2016-01-13')
        self.assertEqual(len(created_bnk_stmt[2].line_ids), 1, 'new statement should only have one line')
        self.assertDate(created_bnk_stmt[3].date, '2016-01-15')
        self.assertEqual(len(created_bnk_stmt[3].line_ids), 1, 'existing statement should still only have one line')
        self.assertDate(created_bnk_stmt[4].date, '2016-01-16')
        self.assertEqual(len(created_bnk_stmt[4].line_ids), 1, 'new statement should only have one line')
        # Check balance of each statements
        self.assertEqual(created_bnk_stmt[0].balance_start, 0)
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 30)
        self.assertEqual(created_bnk_stmt[1].balance_start, 30)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 40)
        self.assertEqual(created_bnk_stmt[2].balance_start, 40)
        self.assertEqual(created_bnk_stmt[2].balance_end_real, 50)
        self.assertEqual(created_bnk_stmt[3].balance_start, 50)
        self.assertEqual(created_bnk_stmt[3].balance_end_real, 60)
        self.assertEqual(created_bnk_stmt[4].balance_start, 60)
        self.assertEqual(created_bnk_stmt[4].balance_end_real, 70)

        # Post first statement and then try adding new transaction to it, it should be reset to draft
        self.confirm_bank_statement(created_bnk_stmt[0])
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc', limit=1)
        self.assertEqual(created_bnk_stmt.state, 'confirm', 'Statement should be posted')
        transactions = self.create_transactions(['2016-01-10'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 80)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 4, '4 lines should have been added to first statement')
        self.assertEqual(created_bnk_stmt[0].state, 'posted', 'Statement should be reset to draft')


    def test_creation_every_week(self):
        self.bank_journal.write({'bank_statement_creation': 'week'})
        transactions = self.create_transactions(['2016-01-10', '2016-01-15'])
        # first synchronization, no previous bank statement
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 20)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 2, 'Should have created two bank statements, one for each transaction')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 1, 'bank statement should have 1 line')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 1, 'bank statement should have 1 line')
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 10)
        self.assertEqual(created_bnk_stmt[1].balance_start, 10)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 20)
        # The date of the statement if the first date of the week (starting monday)
        self.assertDate(created_bnk_stmt[0].date, '2016-01-04')
        self.assertEqual(created_bnk_stmt[0].name, 'Online synchronization from 2016-01-04 to 2016-01-10')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-11')
        self.assertEqual(created_bnk_stmt[1].name, 'Online synchronization from 2016-01-11 to 2016-01-17')

        # Add new transactions, 2 should be in first statement, one in second statement and one newly created
        transactions = self.create_transactions(['2016-01-08', '2016-01-04', '2016-01-13', '2016-01-18'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 60)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 3, 'Should have created one new bank statements')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 3, 'bank statement should have 3 lines')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 2, 'bank statement should have 2 lines')
        self.assertEqual(len(created_bnk_stmt[2].line_ids), 1, 'bank statement should have 1 line')
        # The date of the statement if the first date of the week (starting monday)
        self.assertDate(created_bnk_stmt[0].date, '2016-01-04')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-11')
        self.assertDate(created_bnk_stmt[2].date, '2016-01-18')
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 30)
        self.assertEqual(created_bnk_stmt[1].balance_start, 30)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 50)
        self.assertEqual(created_bnk_stmt[2].balance_start, 50)
        self.assertEqual(created_bnk_stmt[2].balance_end_real, 60)


    def test_creation_every_2weeks(self):
        self.bank_journal.write({'bank_statement_creation': 'bimonthly'})
        
        transactions = self.create_transactions(['2016-01-10', '2016-01-15'])
        # first synchronization, no previous bank statement
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 20)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 2, 'Should have created two bank statements, one for each transaction')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 1, 'bank statement should have 1 line')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 1, 'bank statement should have 1 line')
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 10)
        self.assertEqual(created_bnk_stmt[1].balance_start, 10)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 20)
        # The date of the statement if either first of 15 of the month
        self.assertDate(created_bnk_stmt[0].date, '2016-01-01')
        self.assertEqual(created_bnk_stmt[0].name, 'Online synchronization from 2016-01-01 to 2016-01-14')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-15')
        self.assertEqual(created_bnk_stmt[1].name, 'Online synchronization from 2016-01-15 to 2016-01-31')

        # Add new transactions, 2 should be in first statement, one in second statement and one newly created
        transactions = self.create_transactions(['2016-01-08', '2016-01-04', '2016-01-18', '2016-02-01'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 60)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 3, 'Should have created one new bank statements')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 3, 'bank statement should have 3 lines')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 2, 'bank statement should have 2 lines')
        self.assertEqual(len(created_bnk_stmt[2].line_ids), 1, 'bank statement should have 1 line')
        # The date of the statement if the first date of the week (starting monday)
        self.assertDate(created_bnk_stmt[0].date, '2016-01-01')
        self.assertDate(created_bnk_stmt[1].date, '2016-01-15')
        self.assertDate(created_bnk_stmt[2].date, '2016-02-01')
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 30)
        self.assertEqual(created_bnk_stmt[1].balance_start, 30)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 50)
        self.assertEqual(created_bnk_stmt[2].balance_start, 50)
        self.assertEqual(created_bnk_stmt[2].balance_end_real, 60)


    def test_creation_every_month(self):
        self.bank_journal.write({'bank_statement_creation': 'month'})

        transactions = self.create_transactions(['2016-01-10', '2016-02-15'])
        # first synchronization, no previous bank statement
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 20)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 2, 'Should have created two bank statements, one for each transaction')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 1, 'bank statement should have 1 line')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 1, 'bank statement should have 1 line')
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 10)
        self.assertEqual(created_bnk_stmt[1].balance_start, 10)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 20)
        # The date of the statement is first of the month
        self.assertDate(created_bnk_stmt[0].date, '2016-01-01')
        self.assertEqual(created_bnk_stmt[0].name, 'Online synchronization from 2016-01-01 to 2016-01-31')
        self.assertDate(created_bnk_stmt[1].date, '2016-02-01')
        self.assertEqual(created_bnk_stmt[1].name, 'Online synchronization from 2016-02-01 to 2016-02-29')

        # Add new transactions, 2 should be in first statement, one in second statement and one newly created
        transactions = self.create_transactions(['2016-01-08', '2016-01-04', '2016-02-01', '2016-03-18'])
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 60)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id', '=', self.bank_journal.id)], order='date asc')
        self.assertEqual(len(created_bnk_stmt), 3, 'Should have created one new bank statements')
        self.assertEqual(len(created_bnk_stmt[0].line_ids), 3, 'bank statement should have 3 lines')
        self.assertEqual(len(created_bnk_stmt[1].line_ids), 2, 'bank statement should have 2 lines')
        self.assertEqual(len(created_bnk_stmt[2].line_ids), 1, 'bank statement should have 1 line')
        # The date of the statement if the first date of the week (starting monday)
        self.assertDate(created_bnk_stmt[0].date, '2016-01-01')
        self.assertDate(created_bnk_stmt[1].date, '2016-02-01')
        self.assertDate(created_bnk_stmt[2].date, '2016-03-01')
        self.assertEqual(created_bnk_stmt[0].balance_end_real, 30)
        self.assertEqual(created_bnk_stmt[1].balance_start, 30)
        self.assertEqual(created_bnk_stmt[1].balance_end_real, 50)
        self.assertEqual(created_bnk_stmt[2].balance_start, 50)
        self.assertEqual(created_bnk_stmt[2].balance_end_real, 60)
        

    def test_assign_partner_auto_bank_stmt(self):
        self.bank_journal.write({'bank_statement_creation': 'day'})
        agrolait = self.env['res.partner'].create({'name': 'A partner'})
        self.assertEqual(agrolait.online_partner_vendor_name, False)
        self.assertEqual(agrolait.online_partner_bank_account, False)
        transactions = self.create_transaction_partner(date='2016-01-01', vendor_name='test_vendor_name')
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 50)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id','=',self.bank_journal.id)], order='date desc', limit=1)
        # Ensure that bank statement has no partner set
        self.assertEqual(created_bnk_stmt.line_ids[0].partner_id, self.env['res.partner'])
        # Assign partner and Validate bank statement
        created_bnk_stmt.line_ids[0].write({'partner_id': agrolait.id})
        # process the bank statement line
        self.confirm_bank_statement(created_bnk_stmt)
        # Check that partner has correct vendor_name associated to it
        self.assertEqual(agrolait.online_partner_vendor_name, 'test_vendor_name')
        self.assertEqual(agrolait.online_partner_bank_account, False)
        
        # Create another statement with a partner
        transactions = self.create_transaction_partner(date='2016-01-02', partner_id=agrolait.id, vendor_name='test_other_vendor_name', account_number='123')
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 100)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id','=',self.bank_journal.id)], order='date desc', limit=1)
        # Ensure that statement has a partner set
        self.assertEqual(created_bnk_stmt.line_ids[0].partner_id, agrolait)
        # Validate and check that partner has no vendor_name set and has an account_number set instead
        self.confirm_bank_statement(created_bnk_stmt)
        self.assertEqual(agrolait.online_partner_vendor_name, False)
        self.assertEqual(agrolait.online_partner_bank_account, '123')

        # Create another statement with same information
        transactions = self.create_transaction_partner(date='2016-01-03', partner_id=agrolait.id, account_number='123')
        self.bnk_stmt.online_sync_bank_statement(transactions, self.bank_journal, 150)
        created_bnk_stmt = self.bnk_stmt.search([('journal_id','=',self.bank_journal.id)], order='date desc', limit=1)
        # Ensure that statement has a partner set
        self.assertEqual(created_bnk_stmt.line_ids[0].partner_id, agrolait)
        # Validate and check that partner has no vendor_name set and has same account_number as previous
        self.confirm_bank_statement(created_bnk_stmt)
        self.assertEqual(agrolait.online_partner_vendor_name, False)
        self.assertEqual(agrolait.online_partner_bank_account, '123')
