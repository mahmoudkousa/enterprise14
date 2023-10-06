# -*- coding: utf-8 -*-
from .common import TestMxExtendedEdiCommon
from odoo.tests import tagged
from odoo.exceptions import ValidationError

from freezegun import freeze_time


@tagged('post_install', '-at_install')
class TestEdiResults(TestMxExtendedEdiCommon):

    def test_invoice_cfdi_external_trade(self):
        with freeze_time(self.frozen_today):
            self.invoice.l10n_mx_edi_external_trade_type = '02'
            self.invoice.action_post()

            generated_files = self._process_documents_web_services(self.invoice, {'cfdi_3_3'})
            self.assertTrue(generated_files)
            cfdi = generated_files[0]

            current_etree = self.get_xml_tree_from_string(cfdi)
            expected_etree = self.with_applied_xpath(
                self.get_xml_tree_from_string(self.expected_invoice_cfdi_values),
                '''
                    <xpath expr="//Receptor" position="attributes">
                        <attribute name="NumRegIdTrib">123456789</attribute>
                        <attribute name="ResidenciaFiscal">USA</attribute>
                    </xpath>
                    <xpath expr="//Comprobante" position="attributes">
                        <attribute name="Exportacion">02</attribute>
                    </xpath>
                    <xpath expr="//Comprobante" position="inside">
                        <Complemento>
                            <ComercioExterior
                                CertificadoOrigen="0"
                                ClaveDePedimento="A1"
                                Incoterm="FCA"
                                Subdivision="0"
                                TipoCambioUSD="0.250000"
                                TipoOperacion="2"
                                TotalUSD="20000.00"
                                Version="1.1">
                                <Emisor>
                                    <Domicilio
                                        Calle="Campobasso Norte"
                                        CodigoPostal="85134"
                                        Estado="SON"
                                        Localidad="04"
                                        NumeroExterior="3206"
                                        NumeroInterior="9000"
                                        Pais="MEX"/>
                                </Emisor>
                                <Receptor
                                    NumRegIdTrib="123456789">
                                    <Domicilio
                                        CodigoPostal="39301"
                                        Estado="NV"
                                        Pais="USA"/>
                                </Receptor>
                                <Mercancias>
                                    <Mercancia
                                        FraccionArancelaria="7212100399"
                                        UnidadAduana="06"
                                        CantidadAduana="0.000"
                                        ValorDolares="20000.00"
                                        ValorUnitarioAduana="4000.00"/>
                                </Mercancias>
                            </ComercioExterior>
                        </Complemento>
                    </xpath>
                ''',
            )
            self.assertXmlTreeEqual(current_etree, expected_etree)

    def test_invoice_cfdi_customs_number(self):
        with freeze_time(self.frozen_today):
            # The format of the customs number is incorrect.
            with self.assertRaises(ValidationError), self.cr.savepoint():
                self.invoice.invoice_line_ids.l10n_mx_edi_customs_number = '15  48  30  001234'

            self.invoice.invoice_line_ids.l10n_mx_edi_customs_number = '15  48  3009  0001234,15  48  3009  0001235'

            self.invoice.action_post()

            generated_files = self._process_documents_web_services(self.invoice, {'cfdi_3_3'})
            self.assertTrue(generated_files)
            cfdi = generated_files[0]

            current_etree = self.get_xml_tree_from_string(cfdi)
            expected_etree = self.with_applied_xpath(
                self.get_xml_tree_from_string(self.expected_invoice_cfdi_values),
                '''
                    <xpath expr="//Concepto" position="inside">
                        <InformacionAduanera NumeroPedimento="15  48  3009  0001234"/>
                        <InformacionAduanera NumeroPedimento="15  48  3009  0001235"/>
                    </xpath>
                ''',
            )
            self.assertXmlTreeEqual(current_etree, expected_etree)
