# coding: utf-8
import os
import re
from unittest.mock import patch, Mock

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.tools import misc, mute_logger


@tagged('post_install', '-at_install')
class TestColumbianInvoice(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_co.l10n_co_chart_template_generic'):
        super(TestColumbianInvoice, cls).setUpClass(chart_template_ref=chart_template_ref)

        cls.salesperson = cls.env.ref('base.user_admin')
        cls.salesperson.function = 'Sales'

        currency_cop = cls.env.ref('base.COP')

        report_text = 'GRANDES CONTRIBUYENTES SHD Res. DDI-042065 13-10-17'
        cls.company_data['company'].write({
            'country_id': cls.env.ref('base.co').id,
            'l10n_co_edi_header_gran_contribuyente': report_text,
            'l10n_co_edi_header_tipo_de_regimen': report_text,
            'l10n_co_edi_header_retenedores_de_iva': report_text,
            'l10n_co_edi_header_autorretenedores': report_text,
            'l10n_co_edi_header_resolucion_aplicable': report_text,
            'l10n_co_edi_header_actividad_economica': report_text,
            'l10n_co_edi_header_bank_information': report_text,
            'vat': '213123432-1',
            'phone': '+1 555 123 8069',
            'website': 'http://www.example.com',
            'email': 'info@yourcompany.example.com',
            'street': 'Route de Ramilies',
            'zip': '1234',
            'city': 'Bogota',
            'state_id': cls.env.ref('base.state_co_01').id,
        })

        cls.company_data['company'].partner_id.write({
            'l10n_latam_identification_type_id': cls.env.ref('l10n_co.rut'),
            'l10n_co_edi_representation_type_id': cls.env.ref('l10n_co_edi.representation_type_0').id,
            'l10n_co_edi_establishment_type_id': cls.env.ref('l10n_co_edi.establishment_type_0').id,
            'l10n_co_edi_obligation_type_ids': [(6, 0, [cls.env.ref('l10n_co_edi.obligation_type_1').id])],
            'l10n_co_edi_customs_type_ids': [(6, 0, [cls.env.ref('l10n_co_edi.customs_type_0').id])],
            'l10n_co_edi_large_taxpayer': True,
        })

        cls.company_data_2['company'].write({
            'country_id': cls.env.ref('base.co').id,
            'phone': '(870)-931-0505',
            'website': 'hhtp://wwww.company_2.com',
            'email': 'company_2@example.com',
            'street': 'Route de Eghezée',
            'zip': '4567',
            'city': 'Medellín',
            'state_id': cls.env.ref('base.state_co_02').id,
            'vat': '213.123.432-1',
        })

        cls.company_data_2['company'].partner_id.write({
            'l10n_latam_identification_type_id': cls.env.ref('l10n_co.rut'),
            'l10n_co_edi_representation_type_id': cls.env.ref('l10n_co_edi.representation_type_0').id,
            'l10n_co_edi_establishment_type_id': cls.env.ref('l10n_co_edi.establishment_type_0').id,
            'l10n_co_edi_obligation_type_ids': [(6, 0, [cls.env.ref('l10n_co_edi.obligation_type_1').id])],
            'l10n_co_edi_customs_type_ids': [(6, 0, [cls.env.ref('l10n_co_edi.customs_type_0').id])],
            'l10n_co_edi_large_taxpayer': True,
        })

        cls.product_a.default_code = 'P0000'

        cls.tax = cls.company_data['default_tax_sale']
        cls.tax.amount = 15
        cls.tax.l10n_co_edi_type = cls.env.ref('l10n_co_edi.tax_type_0')
        cls.retention_tax = cls.tax.copy({
            'l10n_co_edi_type': cls.env.ref('l10n_co_edi.tax_type_9').id
        })

        cls.account_revenue = cls.company_data['default_account_revenue']

        cls.env.ref('uom.product_uom_unit').l10n_co_edi_ubl = 'S7'

        env = cls.env
        chart_template = env.ref('l10n_co.l10n_co_chart_template_generic', raise_if_not_found=False)
        tax_templates = env['account.tax.template'].search([
            ('chart_template_id', '=', chart_template.id),
            ('type_tax_use', '=', 'sale'),
            ('l10n_co_edi_type', '!=', False)
        ])
        xml_ids = tax_templates.get_external_id()
        company = cls.company_data['company']
        for tax_template in tax_templates:
            module, xml_id = xml_ids.get(tax_template.id).split('.')
            tax = env.ref('%s.%s_%s' % (module, company.id, xml_id), raise_if_not_found=False)
            if tax:
                tax.l10n_co_edi_type = tax_template.l10n_co_edi_type

    def test_dont_handle_non_colombian(self):
        self.company_data['company'].country_id = self.env.ref('base.us')
        product = self.product_a
        invoice = self.env['account.move'].with_context(default_move_type='out_invoice').create({
            'partner_id': self.company_data_2['company'].partner_id.id,
            'invoice_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 42,
                    'name': 'something',
                })
            ]
        })

        invoice.action_post()
        self.assertEqual(invoice.l10n_co_edi_invoice_status, 'not_sent',
                         'Invoices belonging to a non-Colombian company should not be sent.')

    def _validate_and_compare(self, invoice, invoice_name, filename_expected):

        return_value = {
            'message': 'mocked success',
            'transactionId': 'mocked_success',
        }
        with patch('odoo.addons.l10n_co_edi.models.carvajal_request.CarvajalRequest.upload', new=Mock(return_value=return_value)):
            with patch('odoo.addons.l10n_co_edi.models.carvajal_request.CarvajalRequest._init_client', new=Mock(return_value=None)):
                invoice.action_post()

        invoice.name = invoice_name
        generated_xml = invoice._l10n_co_edi_generate_xml().decode()

        # the ENC_{7,8,16} tags contain information related to the "current" date
        for date_tag in ('ENC_7', 'ENC_8', 'ENC_16'):
            generated_xml = re.sub('<%s>.*</%s>' % (date_tag, date_tag), '', generated_xml)

        # show the full diff
        self.maxDiff = None
        with misc.file_open(os.path.join('l10n_co_edi', 'tests', filename_expected)) as f:
            file_contents = f.read()
            file_contents_tree = self.get_xml_tree_from_string(file_contents.encode())
            generated_xml_tree = self.get_xml_tree_from_string(generated_xml.encode())
            self.assertXmlTreeEqual(file_contents_tree, generated_xml_tree)

    def test_invoice(self):
        '''Tests if we generate an accepted XML for an invoice and a credit note.'''

        product = self.product_a
        invoice = self.env['account.move'].create({
            'partner_id': self.company_data_2['company'].partner_id.id,
            'move_type': 'out_invoice',
            'ref': 'reference',
            'invoice_date': '2020-08-31',
            'invoice_user_id': self.salesperson.id,
            'name': 'OC 123',
            'invoice_payment_term_id': self.env.ref('account.account_payment_term_end_following_month').id,
            'invoice_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 150,
                    'price_unit': 250,
                    'discount': 10,
                    'name': 'Line 1',
                    'tax_ids': [(6, 0, (self.tax.id, self.retention_tax.id))],
                }),
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 0.2,
                    'name': 'Line 2',
                    'tax_ids': [(6, 0, (self.tax.id, self.retention_tax.id))],
                    'product_uom_id': self.env.ref('uom.product_uom_unit').id,
                })
            ]
        })

        self._validate_and_compare(invoice, 'TEST/00001', 'accepted_invoice.xml')

        # To stop a warning about "Tax Base Amount not computable
        # probably due to a change in an underlying tax " which seems
        # to be expected when generating refunds.
        with mute_logger('odoo.addons.account.models.account_invoice'):
            credit_note = invoice._reverse_moves([{'invoice_date': '2020-08-31'}])

        self._validate_and_compare(credit_note, 'TEST/00002', 'accepted_credit_note.xml')

    def test_bigger_invoice(self):
        product = self.product_a


        tax_19 = self._get_tax_by_xml_id('tax_8')
        tax_5 = self._get_tax_by_xml_id('tax_9')
        tax_exento = self._get_tax_by_xml_id('tax_10')
        tax_excluido = self._get_tax_by_xml_id('tax_11')

        tax_rtefte25 = self._get_tax_by_xml_id('tax_53')
        tax_rtefte35 = self._get_tax_by_xml_id('tax_54')

        tax_rteiva15for19 = self._get_tax_by_xml_id('tax_56')

        tax_rteica414 = self._get_tax_by_xml_id('tax_57')
        tax_rteica966 = self._get_tax_by_xml_id('tax_58')


        invoice2 = self.env['account.move'].create({
            'partner_id': self.company_data_2['company'].partner_id.id,
            'move_type': 'out_invoice',
            'ref': 'reference',
            'invoice_date': '2020-08-31',
            'invoice_user_id': self.salesperson.id,
            'name': 'OC 123',
            'invoice_payment_term_id': self.env.ref('account.account_payment_term_end_following_month').id,
            'invoice_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 10.0,
                    'price_unit': 500,
                    'name': 'Line 1',
                    'tax_ids': [(6, 0, (tax_19.id, tax_rtefte25.id, tax_rteiva15for19.id, tax_rteica414.id))],
                }),
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 800.4,
                    'name': 'Line 2',
                    'tax_ids': [(6, 0, (tax_19.id, tax_rtefte35.id, tax_rteica966.id))],
                    'product_uom_id': self.env.ref('uom.product_uom_unit').id,
                }),
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 500.0,
                    'name': 'Line 3',
                    'tax_ids': [(6, 0, (tax_exento.id,))],
                    'product_uom_id': self.env.ref('uom.product_uom_unit').id,
                }),
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 500.0,
                    'name': 'Line 4',
                    'tax_ids': [(6, 0, (tax_excluido.id,))],
                    'product_uom_id': self.env.ref('uom.product_uom_unit').id,
                }),
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 500.0,
                    'name': 'Line 5',
                    'tax_ids': [(6, 0, (tax_5.id,))],
                    'product_uom_id': self.env.ref('uom.product_uom_unit').id,
                })
            ]
        })
        self._validate_and_compare(invoice2, 'TEST/00003', 'accepted_invoice2.xml')

    def test_exempt_only_invoice(self):
        product = self.product_a

        tax_exento = self._get_tax_by_xml_id('tax_10')
        tax_excluido = self._get_tax_by_xml_id('tax_11')

        invoice2 = self.env['account.move'].create({
            'partner_id': self.company_data_2['company'].partner_id.id,
            'move_type': 'out_invoice',
            'ref': 'reference',
            'invoice_date': '2020-08-31',
            'invoice_user_id': self.salesperson.id,
            'name': 'OC 12',
            'invoice_payment_term_id': self.env.ref('account.account_payment_term_end_following_month').id,
            'invoice_line_ids': [
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 10.0,
                    'price_unit': 500,
                    'name': 'Line 1',
                    'tax_ids': [(6, 0, (tax_exento.id,))],
                }),
                (0, 0, {
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 800.4,
                    'name': 'Line 2',
                    'tax_ids': [(6, 0, (tax_excluido.id,))],
                    'product_uom_id': self.env.ref('uom.product_uom_unit').id,
                }),
            ]
        })
        self._validate_and_compare(invoice2, 'TEST/00004', 'accepted_invoice3.xml')

    def _get_tax_by_xml_id(self, template_xml_id):
        """ Helper to retrieve a tax easily.

        :param template_xml_id: The tax's template xml id.
        :return:                An account.tax record
        """
        return self.env.ref(f'l10n_co.{self.env.company.id}_l10n_co_{template_xml_id}')
