from freezegun import freeze_time
from odoo.tests import tagged
from odoo import fields
from odoo.tools.misc import NON_BREAKING_SPACE
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon

@tagged('post_install', '-at_install')
class TestSaleReport(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        country = cls.env['res.country'].create({
            'name': 'Company Country',
            'code': 'XD',
            'intrastat': True,
        })
        cls.company_data['company'].country_id = country
        cls.report = cls.env['account.sales.report'].with_context(
            allowed_company_ids=cls.company_data['company'].ids
        )

        cls.partner_a = cls.env['res.partner'].create({
            'name': 'Partner A',
            'country_id': cls.env['res.country'].create({
                'name': 'Country A',
                'code': 'ZZ',
                'intrastat': True,
            }).id,
            'vat': 'AA123456789',
        })
        cls.partner_b = cls.env['res.partner'].create({
            'name': 'Partner B',
            'country_id': cls.env['res.country'].create({
                'name': 'Country B',
                'code': 'YY',
                'intrastat': True,
            }).id,
            'vat': 'BB123456789',
        })

    def _create_invoices(self, data):
        move_vals_list = []
        for partner, price_unit in data:
            move_vals_list.append({
                'move_type': 'out_invoice',
                'partner_id': partner,
                'invoice_date': fields.Date.from_string('2019-12-01'),
                'invoice_line_ids': [
                    (0, 0, {
                        'name': 'line_1',
                        'price_unit': price_unit,
                        'quantity': 1.0,
                    }),
                ],
            })
        ctx = {'allowed_company_ids': self.company_data['company'].ids}
        moves = self.env['account.move'].with_context(ctx).create(move_vals_list)
        moves.action_post()

    @freeze_time('2019-12-31')
    def test_child_contact(self):
        """Test parent and child contacts are grouped on same line"""
        partner_a_child = self.env['res.partner'].create({
            'name': 'Partner A Child',
            'parent_id': self.partner_a.id,
        })
        self._create_invoices([
            (partner_a_child, 300),
            (self.partner_a, 300),
            (self.partner_a, 500),
            (self.partner_b, 500),
            (self.partner_a, 700),
            (self.partner_b, 700),
        ])
        options = self.report._get_options(None)
        lines = self.report._get_lines(options)
        # pylint: disable=C0326
        self.assertLinesValues(
            lines,
            #   Partner               vat,                Amount
            [   0,                    1,                  3],
            [
                (self.partner_a.name, self.partner_a.vat, f'${NON_BREAKING_SPACE}1,800.00'),
                (self.partner_b.name, self.partner_b.vat, f'${NON_BREAKING_SPACE}1,200.00'),
                ('Total',             '',                 f'${NON_BREAKING_SPACE}3,000.00'),
            ],
        )
