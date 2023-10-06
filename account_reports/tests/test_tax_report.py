# -*- coding: utf-8 -*-
from unittest.mock import patch

from .common import TestAccountReportsCommon
from odoo import fields
from odoo.tests import tagged
from odoo.tests.common import Form
from odoo.exceptions import UserError


@tagged('post_install', '-at_install')
class TestTaxReport(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.fiscal_country = cls.env['res.country'].create({
            'name': "L'Île de la Mouche",
            'code': 'YY',
        })
        cls.company_data['company'].country_id = cls.fiscal_country
        cls.company_data['company'].account_tax_periodicity = 'trimester'

        cls.tax_account = cls.env['account.account'].create({
            'name': 'Tax Account',
            'code': '250000',
            'user_type_id': cls.env.ref('account.data_account_type_current_liabilities').id,
            'company_id': cls.company_data['company'].id,
        })

        cls.tax_group_sale = cls.env['account.tax.group'].create({
            'name': 'tax_group_sale',
            'property_tax_receivable_account_id': cls.company_data['default_account_receivable'].copy().id,
            'property_tax_payable_account_id': cls.company_data['default_account_payable'].copy().id,
        })
        cls.tax_group_purchase = cls.env['account.tax.group'].create({
            'name': 'tax_group_purchase',
            'property_tax_receivable_account_id': cls.company_data['default_account_receivable'].copy().id,
            'property_tax_payable_account_id': cls.company_data['default_account_payable'].copy().id,
        })

        # ==== Sale taxes: group of two taxes having type_tax_use = 'sale' ====

        cls.sale_tax_percentage_incl_1 = cls.env['account.tax'].create({
            'name': 'sale_tax_percentage_incl_1',
            'amount': 20.0,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'price_include': True,
            'tax_group_id': cls.tax_group_sale.id,
        })

        cls.sale_tax_percentage_excl = cls.env['account.tax'].create({
            'name': 'sale_tax_percentage_excl',
            'amount': 10.0,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'tax_group_id': cls.tax_group_sale.id,
        })

        cls.sale_tax_group = cls.env['account.tax'].create({
            'name': 'sale_tax_group',
            'amount_type': 'group',
            'type_tax_use': 'sale',
            'children_tax_ids': [(6, 0, (cls.sale_tax_percentage_incl_1 + cls.sale_tax_percentage_excl).ids)],
        })

        cls.move_sale = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'journal_id': cls.company_data['default_journal_sale'].id,
            'line_ids': [
                (0, 0, {
                    'debit': 1320.0,
                    'credit': 0.0,
                    'account_id': cls.company_data['default_account_receivable'].id,
                }),
                (0, 0, {
                    'debit': 0.0,
                    'credit': 120.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.sale_tax_percentage_excl.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                }),
                (0, 0, {
                    'debit': 0.0,
                    'credit': 200.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.sale_tax_percentage_incl_1.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                    'tax_ids': [(6, 0, cls.sale_tax_percentage_excl.ids)]
                }),
                (0, 0, {
                    'debit': 0.0,
                    'credit': 1000.0,
                    'account_id': cls.company_data['default_account_revenue'].id,
                    'tax_ids': [(6, 0, cls.sale_tax_group.ids)]
                }),
            ],
        })
        cls.move_sale.action_post()

        # ==== Purchase taxes: group of taxes having type_tax_use = 'none' ====

        cls.none_tax_percentage_incl_2 = cls.env['account.tax'].create({
            'name': 'none_tax_percentage_incl_2',
            'amount': 20.0,
            'amount_type': 'percent',
            'type_tax_use': 'none',
            'price_include': True,
            'tax_group_id': cls.tax_group_purchase.id,
        })

        cls.none_tax_percentage_excl = cls.env['account.tax'].create({
            'name': 'none_tax_percentage_excl',
            'amount': 30.0,
            'amount_type': 'percent',
            'type_tax_use': 'none',
            'tax_group_id': cls.tax_group_purchase.id,
        })

        cls.purchase_tax_group = cls.env['account.tax'].create({
            'name': 'purchase_tax_group',
            'amount_type': 'group',
            'type_tax_use': 'purchase',
            'children_tax_ids': [(6, 0, (cls.none_tax_percentage_incl_2 + cls.none_tax_percentage_excl).ids)],
        })

        cls.move_purchase = cls.env['account.move'].create({
            'move_type': 'entry',
            'date': '2016-01-01',
            'journal_id': cls.company_data['default_journal_purchase'].id,
            'line_ids': [
                (0, 0, {
                    'debit': 0.0,
                    'credit': 3120.0,
                    'account_id': cls.company_data['default_account_payable'].id,
                }),
                (0, 0, {
                    'debit': 720.0,
                    'credit': 0.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.none_tax_percentage_excl.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                }),
                (0, 0, {
                    'debit': 400.0,
                    'credit': 0.0,
                    'account_id': cls.tax_account.id,
                    'tax_repartition_line_id': cls.none_tax_percentage_incl_2.invoice_repartition_line_ids.filtered(lambda x: x.repartition_type == 'tax').id,
                    'tax_ids': [(6, 0, cls.none_tax_percentage_excl.ids)]
                }),
                (0, 0, {
                    'debit': 2000.0,
                    'credit': 0.0,
                    'account_id': cls.company_data['default_account_expense'].id,
                    'tax_ids': [(6, 0, cls.purchase_tax_group.ids)]
                }),
            ],
        })
        cls.move_purchase.action_post()

    def test_automatic_vat_closing(self):
        def _get_vat_report_attachments(*args, **kwargs):
            return []

        (self.sale_tax_group + self.purchase_tax_group)\
            .children_tax_ids\
            .invoice_repartition_line_ids\
            .use_in_tax_closing = True

        report = self.env['account.generic.tax.report']

        # We set the tax report's options so that it opens a period within the first trimester.
        # This period will be used to find the tax period, and the dates from this
        # period will be used to create the tax closing entry (hence finding the entries on 2016-01-01 here)
        options = self._init_options(report, fields.Date.from_string('2016-01-05'), fields.Date.from_string('2016-02-22'))

        # Due to warning in runbot when printing wkhtmltopdf in the test, patch the method that fetch the pdf in order
        # to return an empty attachment.
        with patch.object(type(report), '_get_vat_report_attachments', autospec=True, side_effect=_get_vat_report_attachments):
            vat_closing_move = report._generate_tax_closing_entry(options)

            self.assertRecordValues(vat_closing_move, [{
                'date': fields.Date.from_string('2016-03-31'),
                'tax_closing_end_date': fields.Date.from_string('2016-03-31'),
                'journal_id': self.company_data['company'].account_tax_periodicity_journal_id.id,
            }])

            self.assertRecordValues(vat_closing_move.line_ids, [
                # sale_tax_percentage_incl_1
                {'debit': 200.0,    'credit': 0.0,      'account_id': self.tax_account.id},
                # sale_tax_percentage_excl
                {'debit': 120.0,    'credit': 0.0,      'account_id': self.tax_account.id},
                # none_tax_percentage_incl_2
                {'debit': 0.0,      'credit': 400.0,    'account_id': self.tax_account.id},
                # none_tax_percentage_excl
                {'debit': 0.0,      'credit': 720.0,    'account_id': self.tax_account.id},
                # Balance tax current account (receivable)
                {'debit': 0.0,      'credit': 320.0,    'account_id': self.tax_group_sale.property_tax_payable_account_id.id},
                # Balance tax current account (payable)
                {'debit': 1120.0,   'credit': 0.0,      'account_id': self.tax_group_purchase.property_tax_receivable_account_id.id},
            ])

    def test_generic_tax_report(self):
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'))

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX
            [   0,                                          1,              2],
            [
                ('Sales',                                   2200.0,         320.0),

                ('sale_tax_percentage_incl_1 (20.0)',       1000.0,         200.0),
                ('sale_tax_percentage_excl (10.0)',         1200.0,         120.0),

                ('Purchases',                               2000.0,         1120.0),

                ('purchase_tax_group',                      2000.0,         1120.0),
            ],
        )

    def test_generic_tax_report_comparisons(self):
        invoices = self.env['account.move'].create([{
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': invoice_date,
            'date': invoice_date,
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product_a.id,
                'price_unit': price_unit,
                'tax_ids': [(6, 0, self.sale_tax_percentage_excl.ids)],
            })],
        } for invoice_date, price_unit in (('2019-01-01', 100.0), ('2019-02-01', 1000.0), ('2019-03-01', 10000.0))])
        invoices.action_post()

        report = self.env['account.generic.tax.report']
        options = self._init_options(report, fields.Date.from_string('2019-03-01'), fields.Date.from_string('2019-03-31'))
        options = self._update_comparison_filter(options, report, 'previous_period', 2)

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX             NET             TAX             NET             TAX
            [   0,                                          1,              2,              3,              4,              5,              6],
            [
                ('Sales',                                   10000.0,        1000.0,         1000.0,         100.0,          100.0,          10.0),
                ('sale_tax_percentage_excl (10.0)',         10000.0,        1000.0,         1000.0,         100.0,          100.0,          10.0),
            ],
        )

    def test_generic_tax_report_by_account_tax(self):
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'))
        options['tax_report'] = 'account_tax'
        options['group_by'] = 'account_tax'
        with self.assertRaises(UserError):
            report._get_lines(options)

        # Remove the move using a tax with 'amount_type': 'group'
        self.move_purchase.button_draft()
        self.move_purchase.posted_before = False
        self.move_purchase.unlink()
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX
            [   0,                                               1,             2],
            [
                ('Sales',                                   2200.0,         320.0),
                ('400000 Product Sales',                    2000.0,         300.0),
                ('sale_tax_percentage_incl_1 (20.0)',       1000.0,         200.0),
                ('sale_tax_percentage_excl (10.0)',         1000.0,         100.0),
                ('250000 Tax Account',                       200.0,          20.0),
                ('sale_tax_percentage_excl (10.0)',          200.0,          20.0),
            ],
        )

    def test_generic_tax_report_by_tax_account(self):
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, fields.Date.from_string('2016-01-01'), fields.Date.from_string('2016-12-31'))
        options['tax_report'] = 'tax_account'
        options['group_by'] = 'tax_account'
        with self.assertRaises(UserError):
            report._get_lines(options)

        # Remove the move using a tax with 'amount_type': 'group'
        self.move_purchase.button_draft()
        self.move_purchase.posted_before = False
        self.move_purchase.unlink()
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                        NET             TAX
            [   0,                                               1,             2],
            [
                ('Sales',                                   2200.0,         320.0),
                ('sale_tax_percentage_incl_1 (20.0)',       1000.0,         200.0),
                ('400000 Product Sales',                    1000.0,         200.0),
                ('sale_tax_percentage_excl (10.0)',         1200.0,         120.0),
                ('250000 Tax Account',                       200.0,          20.0),
                ('400000 Product Sales',                    1000.0,         100.0),
            ],
        )

    def test_tax_report_grid(self):
        company = self.company_data['company']

        # We generate a tax report with the following layout
        #/Base
        #   - Base 42%
        #   - Base 11%
        #/Tax
        #   - Tax 42%
        #       - 10.5%
        #       - 31.5%
        #   - Tax 11%
        #/Tax difference (42% - 11%)

        tax_report = self.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': company.country_id.id,
        })

        # We create the lines in a different order from the one they have in report,
        # so that we ensure sequence is taken into account properly when rendering the report
        tax_section = self._create_tax_report_line('Tax', tax_report, sequence=2)
        base_section = self._create_tax_report_line('Base', tax_report, sequence=1)
        base_11_line = self._create_tax_report_line('Base 11%', tax_report, sequence=2, parent_line=base_section, tag_name='base_11')
        base_42_line = self._create_tax_report_line('Base 42%', tax_report, sequence=1, parent_line=base_section, tag_name='base_42')
        tax_42_section = self._create_tax_report_line('Tax 42%', tax_report, sequence=1, parent_line=tax_section, code='tax_42')
        tax_31_5_line = self._create_tax_report_line('Tax 31.5%', tax_report, sequence=2, parent_line=tax_42_section, tag_name='tax_31_5')
        tax_10_5_line = self._create_tax_report_line('Tax 10.5%', tax_report, sequence=1, parent_line=tax_42_section, tag_name='tax_10_5')
        tax_11_line = self._create_tax_report_line('Tax 10.5%', tax_report, sequence=2, parent_line=tax_section, tag_name='tax_11', code='tax_11')
        tax_difference_line = self._create_tax_report_line('Tax difference (42%-11%)', tax_report, sequence=3, formula='tax_42 - tax_11')

        # Create two taxes linked to report lines
        tax_template_11 = self.env['account.tax.template'].create({
            'name': 'Impôt sur les revenus',
            'amount': '11',
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'chart_template_id': company.chart_template_id.id,
            'invoice_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'plus_report_line_ids': [base_11_line.id],
                }),

                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [tax_11_line.id],
                }),
            ],
            'refund_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'minus_report_line_ids': [base_11_line.id],
                }),

                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [tax_11_line.id],
                }),
            ],
        })

        tax_template_42 = self.env['account.tax.template'].create({
            'name': 'Impôt sur les revenants',
            'amount': '42',
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'chart_template_id': company.chart_template_id.id,
            'invoice_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'plus_report_line_ids': [base_42_line.id],
                }),

                (0,0, {
                    'factor_percent': 25,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [tax_10_5_line.id],
                }),

                (0,0, {
                    'factor_percent': 75,
                    'repartition_type': 'tax',
                    'plus_report_line_ids': [tax_31_5_line.id],
                }),
            ],
            'refund_repartition_line_ids': [
                (0,0, {
                    'factor_percent': 100,
                    'repartition_type': 'base',
                    'minus_report_line_ids': [base_42_line.id],
                }),

                (0,0, {
                    'factor_percent': 25,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [tax_10_5_line.id],
                }),

                (0,0, {
                    'factor_percent': 75,
                    'repartition_type': 'tax',
                    'minus_report_line_ids': [tax_31_5_line.id],
                }),
            ],
        })
        # The templates needs an xmlid in order so that we can call _generate_tax
        self.env['ir.model.data'].create({
            'name': 'account_reports.test_tax_report_tax_11',
            'module': 'account_reports',
            'res_id': tax_template_11.id,
            'model': 'account.tax.template',
        })
        tax_11_id = tax_template_11._generate_tax(company)['tax_template_to_tax'][tax_template_11.id]
        tax_11 = self.env['account.tax'].browse(tax_11_id)

        self.env['ir.model.data'].create({
            'name': 'account_reports.test_tax_report_tax_42',
            'module': 'account_reports',
            'res_id': tax_template_42.id,
            'model': 'account.tax.template',
        })
        tax_42_id = tax_template_42._generate_tax(company)['tax_template_to_tax'][tax_template_42.id]
        tax_42 = self.env['account.tax'].browse(tax_42_id)

        # Create an invoice using the tax we just made
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_line_ids': [(0, 0, {
                'name': 'Turlututu',
                'price_unit': 100.0,
                'quantity': 1,
                'account_id': self.company_data['default_account_revenue'].id,
                'tax_ids': [(6, 0, (tax_11 + tax_42).ids)],
            })],
        })
        invoice.action_post()

        # Generate the report and check the results
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, invoice.date, invoice.date)
        options['tax_report'] = tax_report.id
        report = report.with_context(report._set_context(options))

        # Invalidate the cache to ensure the lines will be fetched in the right order.
        report.invalidate_cache()

        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                Balance
            [   0,                                  1],
            [
                (base_section.name,                 200),
                (base_42_line.name,                 100),
                (base_11_line.name,                 100),
                (tax_section.name,                  53),
                (tax_42_section.name,               42),
                (tax_10_5_line.name,                10.5),
                (tax_31_5_line.name,                31.5),
                (tax_11_line.name,                  11),
                (tax_difference_line.name,          31),
            ],
        )

        # We refund the invoice
        refund_wizard = self.env['account.move.reversal'].with_context(active_model="account.move", active_ids=invoice.ids).create({
            'reason': 'Test refund tax repartition',
            'refund_method': 'cancel',
        })
        refund_wizard.reverse_moves()

        # We check the taxes on refund have impacted the report properly (everything should be 0)
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                                Balance
            [   0,                                  1],
            [
                (base_section.name,                 0),
                (base_42_line.name,                 0),
                (base_11_line.name,                 0),
                (tax_section.name,                  0),
                (tax_42_section.name,               0),
                (tax_10_5_line.name,                0),
                (tax_31_5_line.name,                0),
                (tax_11_line.name,                  0),
                (tax_difference_line.name,          0),
            ],
        )

    def _create_caba_taxes_for_report_lines(self, report_lines_dict, company):
        """ report_lines_dict is a dictionnary mapping tax_type_use values to
        tax report lines.
        """
        rslt = self.env['account.tax']
        for tax_type, report_line in report_lines_dict.items():
            tax_template = self.env['account.tax.template'].create({
                'name': 'Impôt sur tout ce qui bouge',
                'amount': '20',
                'amount_type': 'percent',
                'type_tax_use': tax_type,
                'chart_template_id': company.chart_template_id.id,
                'tax_exigibility': 'on_payment',
                'invoice_repartition_line_ids': [
                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'plus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 25,
                        'repartition_type': 'tax',
                        'plus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 75,
                        'repartition_type': 'tax',
                        'plus_report_line_ids': report_line.ids,
                    }),
                ],
                'refund_repartition_line_ids': [
                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'minus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 25,
                        'repartition_type': 'tax',
                        'minus_report_line_ids': report_line.ids,
                    }),

                    (0,0, {
                        'factor_percent': 75,
                        'repartition_type': 'tax',
                    }),
                ],
            })

            # The template needs an xmlid in order so that we can call _generate_tax
            self.env['ir.model.data'].create({
                'name': 'account_reports.test_tax_report_tax_' + tax_type,
                'module': 'account_reports',
                'res_id': tax_template.id,
                'model': 'account.tax.template',
            })
            tax_id = tax_template._generate_tax(self.env.user.company_id)['tax_template_to_tax'][tax_template.id]
            rslt += self.env['account.tax'].browse(tax_id)

        return rslt

    def _create_taxes_for_report_lines(self, report_lines_dict, company):
        """ report_lines_dict is a dictionnary mapping tax_type_use values to
        tax report lines.
        """
        rslt = self.env['account.tax']
        for tax_type, report_line in report_lines_dict.items():
            tax_template = self.env['account.tax.template'].create({
                'name': 'Impôt sur tout ce qui bouge',
                'amount': '20',
                'amount_type': 'percent',
                'type_tax_use': tax_type,
                'chart_template_id': company.chart_template_id.id,
                'invoice_repartition_line_ids': [
                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'plus_report_line_ids': report_line[0].ids,
                    }),

                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'tax',
                        'plus_report_line_ids': report_line[1].ids,
                    }),
                ],
                'refund_repartition_line_ids': [
                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'plus_report_line_ids': report_line[0].ids,
                    }),

                    (0,0, {
                        'factor_percent': 100,
                        'repartition_type': 'tax',
                        'plus_report_line_ids': report_line[1].ids,
                    }),
                ],
            })

            # The template needs an xmlid in order so that we can call _generate_tax
            self.env['ir.model.data'].create({
                'name': 'account_reports.test_tax_report_tax_' + tax_type,
                'module': 'account_reports',
                'res_id': tax_template.id,
                'model': 'account.tax.template',
            })
            tax_id = tax_template._generate_tax(self.env.user.company_id)['tax_template_to_tax'][tax_template.id]
            rslt += self.env['account.tax'].browse(tax_id)

        return rslt

    def test_tax_report_grid_cash_basis(self):
        """ Cash basis moves create for taxes based on payments are handled differently
        by the report; we want to ensure their sign is managed properly.
        """
        today = fields.Date.today()

        company = self.company_data['company']
        partner = self.env['res.partner'].create({'name': 'Char Aznable'})

        # Create a tax report
        tax_report = self.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': self.fiscal_country.id,
        })

        # We create some report lines
        report_lines_dict = {
            'sale': self._create_tax_report_line('Sale', tax_report, sequence=1, tag_name='sale'),
            'purchase': self._create_tax_report_line('Purchase', tax_report, sequence=2, tag_name='purchase'),
        }

        # We create a sale and a purchase tax, linked to our report lines' tags
        taxes = self._create_caba_taxes_for_report_lines(report_lines_dict, company)


        # Create invoice and refund using the tax we just made
        invoice_types = {
            'sale': ('out_invoice', 'out_refund'),
            'purchase': ('in_invoice', 'in_refund')
        }

        account_types = {
            'sale': self.env.ref('account.data_account_type_revenue').id,
            'purchase': self.env.ref('account.data_account_type_expenses').id,
        }
        for tax in taxes:
            account = self.env['account.account'].search([('company_id', '=', company.id), ('user_type_id', '=', account_types[tax.type_tax_use])], limit=1)
            for inv_type in invoice_types[tax.type_tax_use]:
                invoice = self.env['account.move'].create({
                    'move_type': inv_type,
                    'partner_id': partner.id,
                    'invoice_date': today,
                    'invoice_line_ids': [(0, 0, {
                        'name': 'test',
                        'quantity': 1,
                        'account_id': account.id,
                        'price_unit': 100,
                        'tax_ids': [(6, 0, tax.ids)],
                    })],
                })
                invoice.action_post()

                # Pay the invoice, so that the cash basis entries are created
                self.env['account.payment.register'].with_context(active_ids=invoice.ids, active_model='account.move').create({
                    'payment_date': today,
                })._create_payments()

        # Generate the report and check the results
        report = self.env['account.generic.tax.report']
        report_opt = report._get_options({'date': {'period_type': 'custom', 'filter': 'custom', 'date_to': today, 'mode': 'range', 'date_from': today}})
        new_context = report._set_context(report_opt)

        # We check the taxes on invoice have impacted the report properly
        inv_report_lines = report.with_context(new_context)._get_lines(report_opt)

        # 100 (base, invoice) - 100 (base, refund) + 20 (tax, invoice) - 5 (25% tax, refund) = 15
        self.assertLinesValues(
            inv_report_lines,
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale',                     15),
                ('Purchase',                 15),
            ],
        )

    def test_tax_report_grid_cash_basis_refund(self):
        """ Cash basis moves create for taxes based on payments are handled differently
        by the report; we want to ensure their sign is managed properly. This
        test runs the case where an invoice is reconciled with a refund (created
        separetely, so not cancelling it).
        """
        today = fields.Date.today()

        company = self.company_data['company']
        partner = self.env['res.partner'].create({'name': 'Char Aznable'})

        # Create a tax report
        tax_report = self.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': self.fiscal_country.id,
        })

        # We create some report lines
        report_lines_dict = {
            'sale': self._create_tax_report_line('Sale', tax_report, sequence=1, tag_name='sale'),
            'purchase': self._create_tax_report_line('Purchase', tax_report, sequence=2, tag_name='purchase'),
        }

        # We create a sale and a purchase tax, linked to our report lines' tags
        taxes = self._create_caba_taxes_for_report_lines(report_lines_dict, company)


        # Create invoice and refund using the tax we just made, and reconcile them together
        invoice_types = {
            'sale': ('out_invoice', 'out_refund'),
            'purchase': ('in_invoice', 'in_refund')
        }

        account_types = {
            'sale': self.env.ref('account.data_account_type_revenue').id,
            'purchase': self.env.ref('account.data_account_type_expenses').id,
        }

        for tax in taxes:
            invoices = self.env['account.move']
            account = self.env['account.account'].search([('company_id', '=', company.id), ('user_type_id', '=', account_types[tax.type_tax_use])], limit=1)
            for inv_type in invoice_types[tax.type_tax_use]:
                invoice = self.env['account.move'].create({
                    'move_type': inv_type,
                    'partner_id': partner.id,
                    'invoice_date': today,
                    'invoice_line_ids': [(0, 0, {
                        'name': 'test',
                        'quantity': 1,
                        'account_id': account.id,
                        'price_unit': 100,
                        'tax_ids': [(6, 0, tax.ids)],
                    })],
                })
                invoice.action_post()
                invoices += invoice

            invoices.mapped('line_ids').filtered(lambda x: x.account_internal_type in ('receivable', 'payable')).reconcile()

        # Generate the report and check the results
        report = self.env['account.generic.tax.report']
        report_opt = report._get_options({'date': {'period_type': 'custom', 'filter': 'custom', 'date_to': today, 'mode': 'range', 'date_from': today}})
        new_context = report._set_context(report_opt)

        # We check the taxes on invoice have impacted the report properly
        inv_report_lines = report.with_context(new_context)._get_lines(report_opt)

        # 100 (base, invoice) - 100 (base, refund) + 20 (tax, invoice) - 5 (25% tax, refund) = 15
        self.assertLinesValues(
            inv_report_lines,
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale',                     15),
                ('Purchase',                 15),
            ],
        )

    def test_tax_report_grid_cash_basis_misc_pmt(self):
        """ Cash basis moves create for taxes based on payments are handled differently
        by the report; we want to ensure their sign is managed properly. This
        test runs the case where the invoice is paid with a misc operation instead
        of a payment.
        """
        today = fields.Date.today()

        company = self.company_data['company']
        partner = self.env['res.partner'].create({'name': 'Char Aznable'})

        # Create a tax report
        tax_report = self.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': self.fiscal_country.id,
        })

        # We create some report lines
        report_lines_dict = {
            'sale': self._create_tax_report_line('Sale', tax_report, sequence=1, tag_name='sale'),
            'purchase': self._create_tax_report_line('Purchase', tax_report, sequence=2, tag_name='purchase'),
        }

        # We create a sale and a purchase tax, linked to our report lines' tags
        taxes = self._create_caba_taxes_for_report_lines(report_lines_dict, company)


        # Create invoice and refund using the tax we just made
        invoice_types = {
            'sale': ('out_invoice', 'out_refund'),
            'purchase': ('in_invoice', 'in_refund')
        }

        account_types = {
            'sale': self.env.ref('account.data_account_type_revenue').id,
            'purchase': self.env.ref('account.data_account_type_expenses').id,
        }
        for tax in taxes:
            account = self.env['account.account'].search([('company_id', '=', company.id), ('user_type_id', '=', account_types[tax.type_tax_use])], limit=1)
            for inv_type in invoice_types[tax.type_tax_use]:
                invoice = self.env['account.move'].create({
                    'move_type': inv_type,
                    'partner_id': partner.id,
                    'invoice_date': today,
                    'invoice_line_ids': [(0, 0, {
                        'name': 'test',
                        'quantity': 1,
                        'account_id': account.id,
                        'price_unit': 100,
                        'tax_ids': [(6, 0, tax.ids)],
                    })],
                })
                invoice.action_post()

                # Pay the invoice with a misc operation simulating a payment, so that the cash basis entries are created
                invoice_reconcilable_line = invoice.line_ids.filtered(lambda x: x.account_internal_type in ('payable', 'receivable'))
                pmt_move = self.env['account.move'].create({
                    'move_type': 'entry',
                    'date': today,
                    'line_ids': [(0, 0, {
                                    'account_id': invoice_reconcilable_line.account_id.id,
                                    'debit': invoice_reconcilable_line.credit,
                                    'credit': invoice_reconcilable_line.debit,
                                }),
                                (0, 0, {
                                    'account_id': account.id,
                                    'credit': invoice_reconcilable_line.credit,
                                    'debit': invoice_reconcilable_line.debit,
                                })],
                })
                pmt_move.action_post()
                payment_reconcilable_line = pmt_move.line_ids.filtered(lambda x: x.account_internal_type in ('payable', 'receivable'))
                (invoice_reconcilable_line + payment_reconcilable_line).reconcile()

        # Generate the report and check the results
        report = self.env['account.generic.tax.report']
        report_opt = report._get_options({'date': {'period_type': 'custom', 'filter': 'custom', 'date_to': today, 'mode': 'range', 'date_from': today}})
        new_context = report._set_context(report_opt)

        # We check the taxes on invoice have impacted the report properly
        inv_report_lines = report.with_context(new_context)._get_lines(report_opt)

        # 100 (base, invoice) - 100 (base, refund) + 20 (tax, invoice) - 5 (25% tax, refund) = 15
        self.assertLinesValues(
            inv_report_lines,
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale',                     15),
                ('Purchase',                 15),
            ],
        )

    def test_tax_report_multi_inv_line_no_rep_account(self):
        """ Tests the behavior of the tax report when using a tax without any
        repartition account (hence doing its tax lines on the base account),
        and using the tax on two lines (to make sure grouping is handled
        properly by the report).
        We do that for both regular and cash basis taxes.
        """
        # Create taxes
        regular_tax = self.env['account.tax'].create({
            'name': 'Regular',
            'amount': 42,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            # We use default repartition: 1 base line, 1 100% tax line
        })

        caba_tax = self.env['account.tax'].create({
            'name': 'Cash Basis',
            'amount': 42,
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'tax_exigibility': 'on_payment',
            # We use default repartition: 1 base line, 1 100% tax line
        })
        self.env.company.tax_exigibility = True

        # Make one invoice of 2 lines for each of our taxes
        invoice_date = fields.Date.from_string('2021-04-01')
        other_account_revenue = self.company_data['default_account_revenue'].copy()

        regular_invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': invoice_date,
            'invoice_line_ids': [
                (0, 0, {
                    'name': 'line 1',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 100,
                    'tax_ids': [(6, 0, regular_tax.ids)],
                }),

                (0, 0, {
                    'name': 'line 2',
                    'account_id': other_account_revenue.id,
                    'price_unit': 100,
                    'tax_ids': [(6, 0, regular_tax.ids)],
                })
            ],
        })

        caba_invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': invoice_date,
            'invoice_line_ids': [
                (0, 0, {
                    'name': 'line 1',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 100,
                    'tax_ids': [(6, 0, caba_tax.ids)],
                }),


                (0, 0, {
                    'name': 'line 2',
                    'account_id': other_account_revenue.id,
                    'price_unit': 100,
                    'tax_ids': [(6, 0, caba_tax.ids)],
                })
            ],
        })

        # Post the invoices
        regular_invoice.action_post()
        caba_invoice.action_post()

        # Pay cash basis invoice
        self.env['account.payment.register'].with_context(active_ids=caba_invoice.ids, active_model='account.move').create({
            'payment_date': invoice_date,
        })._create_payments()

        # Check the generic report
        report = self.env['account.generic.tax.report']
        options = self._init_options(report, invoice_date, invoice_date)
        self.assertLinesValues(
            report._get_lines(options),
            #   Name                         Net              Tax
            [   0,                             1,               2],
            [
                ("Sales",                    400,             168),
                ("Regular (42.0)",           200,              84),
                ("Cash Basis (42.0)",        200,              84),
            ],
        )

    def test_tax_report_with_entries_on_sale_and_purchase_journals (self):
        """ Ensure signs are managed properly for entry moves on sale/purchase
        journals. This test runs the case where invoice/bill like entries are
        created and reverted.
        """
        today = fields.Date.today()
        test_country = self.env['res.country'].create({
            'name': "Side 3",
            'code': 'ZE',
        })

        company = self.env.user.company_id
        company.country_id = test_country
        tax_report = self.env['account.tax.report'].create({
            'name': 'Test',
            'country_id': company.country_id.id,
        })

        # We create some report lines
        report_lines_dict = {
            'sale': [
                self._create_tax_report_line('Sale base', tax_report, sequence=1, tag_name='sale_b'),
                self._create_tax_report_line('Sale tax', tax_report, sequence=1, tag_name='sale_t'),
            ],
            'purchase': [
                self._create_tax_report_line('Purchase base', tax_report, sequence=2, tag_name='purchase_b'),
                self._create_tax_report_line('Purchase tax', tax_report, sequence=2, tag_name='purchase_t'),
            ],
        }

        # We create a sale and a purchase tax, linked to our report line tags
        taxes = self._create_taxes_for_report_lines(report_lines_dict, company)

        account_types = {
            'sale': self.env.ref('account.data_account_type_revenue').id,
            'purchase': self.env.ref('account.data_account_type_expenses').id,
        }
        for tax in taxes:
            account = self.env['account.account'].search([('company_id', '=', company.id), ('user_type_id', '=', account_types[tax.type_tax_use])], limit=1)
            journal = self.env['account.journal'].search([('company_id', '=', company.id), ('type', '=', tax.type_tax_use)], limit=1)
            # create one entry and it's reverse
            move_form = Form(self.env['account.move'].with_context(default_move_type='entry', default_journal_id=journal.id))
            with move_form.line_ids.new() as line:
                line.account_id = account
                if tax.type_tax_use == 'sale':
                    line.credit = 1000
                else:
                    line.debit = 1000
                line.tax_ids.clear()
                line.tax_ids.add(tax)

                self.assertTrue(line.recompute_tax_line)
            # Create a third account.move.line for balance.
            with move_form.line_ids.new() as line:
                if tax.type_tax_use == 'sale':
                    line.debit = 1200
                else:
                    line.credit = 1200
            move = move_form.save()
            move.action_post()
            refund_wizard = self.env['account.move.reversal'].with_context(active_model="account.move", active_ids=move.ids).create({
                'reason': 'reasons',
                'refund_method': 'cancel',
            })
            refund_wizard.reverse_moves()

        # Generate the report and check the results
        report = self.env['account.generic.tax.report']
        report_opt = report._get_options({'date': {'period_type': 'custom', 'filter': 'custom', 'date_to': today, 'mode': 'range', 'date_from': today}})
        new_context = report._set_context(report_opt)

        # We check the taxes on entries have impacted the report properly
        inv_report_lines = report.with_context(new_context)._get_lines(report_opt)

        self.assertLinesValues(
            inv_report_lines,
            #   Name                      Balance
            [   0,                        1],
            [
                ('Sale base',             2000),
                ('Sale tax',              400),
                ('Purchase base',         2000),
                ('Purchase tax',          400),
            ],
        )
