# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.tests import tagged
from odoo.tests.common import Form
from odoo import fields
from odoo.tools import date_utils
from dateutil.relativedelta import relativedelta


@tagged('post_install', '-at_install')
class LuxembourgElectronicReportTest(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_lu.lu_2011_chart_1'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data['company'].ecdf_prefix = '1234AB'

        cls.out_invoice = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'invoice_line_ids': [
                (0, 0, {
                    'name': 'line_1',
                    'price_unit': 1000.0,
                    'quantity': 1.0,
                    'account_id': cls.company_data['default_account_revenue'].id,
                    'tax_ids': [(6, 0, cls.company_data['default_tax_sale'].ids)],
                }),
            ],
        })

        cls.in_invoice = cls.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'invoice_line_ids': [
                (0, 0, {
                    'name': 'line_1',
                    'price_unit': 800.0,
                    'quantity': 1.0,
                    'account_id': cls.company_data['default_account_expense'].id,
                    'tax_ids': [(6, 0, cls.company_data['default_tax_purchase'].ids)],
                }),
            ],
        })

        (cls.out_invoice + cls.in_invoice).action_post()
    #
    def _filter_zero_lines(self, lines):
        filtered_lines = []
        for line in lines:
            balance_column = line['columns'][0]
            if 'no_format' not in balance_column or balance_column['no_format'] != 0.0:
                filtered_lines.append(line)
        return filtered_lines

    def test_balance_sheet(self):
        report = self.env.ref('l10n_lu_reports.account_financial_report_l10n_lu_bs')
        options = self._init_options(report, fields.Date.from_string('2017-01-01'), fields.Date.from_string('2017-12-31'))

        self.assertLinesValues(
            self._filter_zero_lines(report._get_table(options)[1]),
            #   Name                                            Balance
            [   0,                                              1],
            [
                ('D. Current assets',                           1306.0),
                ('II. Debtors',                                 1306.0),
                ('1. Trade debtors',                            1170.0),
                ('a) becoming due and payable within one year', 1170.0),
                ('4. Other debtors',                            136.0),
                ('a) becoming due and payable within one year', 136.0),
                ('TOTAL (ASSETS)',                              1306.0),
                ('A. Capital and reserves',                      200.0),
                ('VI. Profit or loss for the financial year',    200.0),
                ('C. Creditors',                                 1106.0),
                ('4. Trade creditors',                           936.0),
                ('a) becoming due and payable within one year',  936.0),
                ('8. Other creditors',                           170.0),
                ('a) Tax authorities',                           170.0),
                ('TOTAL (CAPITAL, RESERVES AND LIABILITIES)',    1306.0),
            ],
        )

    def test_profit_and_loss(self):
        report = self.env.ref('l10n_lu_reports.account_financial_report_l10n_lu_pl')
        options = self._init_options(report, fields.Date.from_string('2017-01-01'), fields.Date.from_string('2017-12-31'))

        self.assertLinesValues(
            self._filter_zero_lines(report._get_table(options)[1]),
            #   Name                                                                    Balance
            [   0,                                                                      1],
            [
                ('1. Net turnover',                                                     1000.0),
                ('5. Raw materials and consumables and other external expenses',        -800.0),
                ('a) Raw materials and consumables',                                    -800.0),
                ('16. Profit or loss after taxation',                                    200.0),
                ('18. Profit or loss for the financial year',                            200.0),
            ],
        )

    def test_intrastat_report(self):
        l_tax = self.env['account.tax'].search([('company_id', '=', self.company_data['company'].id), ('name', '=', '0-IC-S-G'), '|', ("active", "=", True), ("active", "=", False)])
        t_tax = self.env['account.tax'].search([('company_id', '=', self.company_data['company'].id), ('name', '=', '0-ICT-S-G'), '|', ("active", "=", True), ("active", "=", False)])
        s_tax = self.env['account.tax'].search([('company_id', '=', self.company_data['company'].id), ('name', '=', '0-IC-S-S'), '|', ("active", "=", True), ("active", "=", False)])
        l_tax.active = t_tax.active = s_tax.active = True

        product_1 = self.env['product.product'].create({'name': 'product_1', 'lst_price': 300.0})
        product_2 = self.env['product.product'].create({'name': 'product_2', 'lst_price': 500.0})
        product_3 = self.env['product.product'].create({'name': 'product_3', 'lst_price': 700.0})
        partner_be = self.env['res.partner'].create({
            'name': 'Partner BE',
            'country_id': self.env.ref('base.be').id,
            'vat': 'BE0477472701',
        })
        partner_fr = self.env['res.partner'].create({
            'name': 'Partner FR',
            'country_id': self.env.ref('base.fr').id,
            'vat': 'FR00000000190',
        })
        partner_lu = self.env['res.partner'].create({
            'name': 'Partner LU',
            'country_id': self.env.ref('base.lu').id,
            'vat': 'LU12345613',
        })
        partner_us = self.env['res.partner'].create({
            'name': 'Partner US',
            'country_id': self.env.ref('base.us').id
        })
        date_today = fields.Date.today()

        invoices = [
            {'partner': partner_be, 'product': product_1, 'tax': l_tax},
            {'partner': partner_be, 'product': product_1, 'tax': l_tax},
            {'partner': partner_be, 'product': product_2, 'tax': t_tax},
            {'partner': partner_be, 'product': product_3, 'tax': s_tax},
            {'partner': partner_fr, 'product': product_2, 'tax': t_tax},
            {'partner': partner_fr, 'product': product_3, 'tax': s_tax},
            {'partner': partner_lu, 'product': product_3, 'tax': s_tax},
            {'partner': partner_us, 'product': product_3, 'tax': s_tax},
        ]

        for inv in invoices:
            move_form = Form(self.env['account.move'].with_context(default_move_type='out_invoice'))
            move_form.invoice_date = date_today
            move_form.partner_id = inv['partner']
            with move_form.invoice_line_ids.new() as line_form:
                line_form.product_id = inv['product']
                line_form.tax_ids.clear()
                line_form.tax_ids.add(inv['tax'])
            move = move_form.save()
            move.action_post()

        report = self.env['l10n.lu.report.partner.vat.intra']
        report = report.with_context(
            date_from=date_today.strftime('%Y-%m-01'),
            date_to=(date_today + relativedelta(day=31)).strftime('%Y-%m-%d')
        )
        options = report._get_options(None)

        options['intrastat_code'] = [
            {'id': 'Shipment', 'name': 'L', 'selected': True, 'lines': self.env.ref('l10n_lu.account_tax_report_line_1b_1_intra_community_goods_pi_vat').ids},
            {'id': 'Triangular', 'name': 'T', 'selected': True, 'lines': self.env.ref('l10n_lu.account_tax_report_line_1b_6_a_subsequent_to_intra_community').ids},
            {'id': 'Services', 'name': 'S', 'selected': True, 'lines': self.env.ref('l10n_lu.account_tax_report_line_1b_6_b1_non_exempt_customer_vat').ids},
        ]
        lines = report._get_lines(options)
        result = []
        for line in lines:
            result.append([line['name']] + [col['name'] for col in line['columns']])

        expected = [
            ['Partner BE', 'BE', '0477472701', 'L', '600.00 €'],
            ['Partner BE', 'BE', '0477472701', 'T', '500.00 €'],
            ['Partner FR', 'FR', '00000000190', 'T', '500.00 €'],
            ['Partner BE', 'BE', '0477472701', 'S', '700.00 €'],
            ['Partner FR', 'FR', '00000000190', 'S', '700.00 €'],
            ['Partner LU', 'LU', '12345613', 'S', '700.00 €'],
            ['Partner US', '', '', 'S', '700.00 €']
        ]
        self.assertListEqual(expected, result, 'Wrong values for Luxembourg intrastat report.')
