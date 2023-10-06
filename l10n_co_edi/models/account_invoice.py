# coding: utf-8
import io
import xml.dom.minidom
import zipfile
import pytz
import requests

from collections import defaultdict
from datetime import timedelta
from functools import lru_cache
from os import listdir

from odoo import api, fields, models, tools, _
from odoo.exceptions import UserError
from odoo.tools import DEFAULT_SERVER_TIME_FORMAT
from odoo.tools.float_utils import float_compare
from .carvajal_request import CarvajalRequest, CarvajalException

import logging

_logger = logging.getLogger(__name__)

DESCRIPTION_CREDIT_CODE = [
    ("1", "Devolución parcial de los bienes y/o no aceptación parcial del servicio"),
    ("2", "Anulación de factura electrónica"),
    ("3", "Rebaja total aplicada"),
    ("4", "Ajuste de precio"),
    ("5", "Otros"),
    ("6", "Otros (Inactive)")
]

DESCRIPTION_DEBIT_CODE = [
    ('1', 'Intereses'),
    ('2', 'Gastos por cobrar'),
    ('3', 'Cambio del valor'),
    ('4', 'Otros'),
]


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_co_edi_datetime_invoice = fields.Datetime(help='Technical field used to store the time of invoice validation.', copy=False)
    l10n_co_edi_type = fields.Selection([
        ('1', 'Factura de venta'),
        ('2', 'Factura de exportación'),
        ('3', 'Documento electrónico de transmisión – tipo 03'),
        ('4', 'Factura electrónica de Venta - tipo 04'),
    ], required=True, default='1', string='Electronic Invoice Type', readonly=True, states={'draft': [('readonly', False)]})
    l10n_co_edi_transaction = fields.Char('Transaction ID',
                                          help='Technical field used to track the status of a submission.',
                                          readonly=True, copy=False)
    l10n_co_edi_invoice_name = fields.Char('Electronic Invoice Name', help='The name of the file sent to Carvajal.',
                                           readonly=True, copy=False)
    l10n_co_edi_invoice_status = fields.Selection([
        ('not_sent', 'Not sent'),
        ('processing', 'En proceso'),
        ('accepted', 'Aceptado'),
        ('rejected', 'Rechazado'),
    ], string='Electronic Invoice Status', help='The status of the document as determined by Carvajal.',
        readonly=True, default='not_sent', copy=False)
    l10n_co_edi_attachment_url = fields.Char('Electronic Invoice Attachment URL',
                                             help='''Will be included in electronic invoice and can point to
                                             e.g. a ZIP containing additional information about the invoice.''', copy=False)
    l10n_co_edi_operation_type = fields.Selection([('10', 'Estandar'),
                                                  ('09', 'AIU'),
                                                  ('11', 'Mandatos'),
                                                  ('12', 'Transporte'),
                                                  ('13', 'Cambiario'),
                                                  ('20', 'Nota Crédito que referencia una factura electrónica'),
                                                  ('20-POS', 'Factura Contingencia PoS - tipo 20'),
                                                  ('22', 'Nota Crédito sin referencia a facturas'),
                                                  ('30', 'Nota Débito que referencia una factura electrónica'),
                                                  ('32', 'Nota Débito sin referencia a facturas'),
                                                  ('23', 'Inactivo: Nota Crédito para facturación electrónica V1 (Decreto 2242)'),
                                                  ('33', 'Inactivo: Nota Débito para facturación electrónica V1 (Decreto 2242)')],
                                                  string="Operation Type", default="10", required=True)
    l10n_co_edi_cufe_cude_ref = fields.Char(string="CUFE/CUDE", readonly=True, copy=False)
    l10n_co_edi_payment_option_id = fields.Many2one('l10n_co_edi.payment.option', string="Payment Option",
                                                    default=lambda self: self.env.ref('l10n_co_edi.payment_option_1', raise_if_not_found=False))
    l10n_co_edi_description_code_credit = fields.Selection(DESCRIPTION_CREDIT_CODE, string="Concepto Nota de Credito")
    l10n_co_edi_is_direct_payment = fields.Boolean("Direct Payment from Colombia", compute="_compute_l10n_co_edi_is_direct_payment")
    l10n_co_edi_description_code_debit = fields.Selection(DESCRIPTION_DEBIT_CODE, string="Concepto Nota de Débito")
    l10n_co_edi_debit_note = fields.Boolean(related="journal_id.l10n_co_edi_debit_note", readonly=True)
    l10n_co_edi_is_support_document = fields.Boolean('Support Document', related='journal_id.l10n_co_edi_is_support_document')

    @api.depends('invoice_date_due', 'date')
    def _compute_l10n_co_edi_is_direct_payment(self):
        for rec in self:
            rec.l10n_co_edi_is_direct_payment = (rec.date == rec.invoice_date_due) and rec.company_id.country_id.code == 'CO'

    @api.onchange('move_type', 'reversed_entry_id', 'l10n_co_edi_invoice_status', 'l10n_co_edi_cufe_cude_ref')
    def _onchange_type(self):
        for rec in self:
            operation_type = False
            if rec.move_type == 'out_refund':
                if rec.reversed_entry_id:
                    operation_type = '20'
                else:
                    operation_type = '22'
            else:
                if rec.l10n_co_edi_debit_note:
                    if rec.l10n_co_edi_invoice_status == 'accepted' and not rec.l10n_co_edi_cufe_cude_ref:
                        operation_type = '23'
                    elif rec.debit_origin_id:
                        operation_type = '30'
                    else:
                        operation_type = '32'
            rec.l10n_co_edi_operation_type = operation_type or '10'

    def _l10n_co_edi_get_environment(self):
        if self.company_id.l10n_co_edi_test_mode:
            return '2'
        return '1'

    def _l10n_co_edi_get_edi_type(self):
        if self.move_type == 'out_refund':
            return "91"
        elif self.move_type == 'out_invoice' and self.l10n_co_edi_debit_note:
            return "92"
        return "{0:0=2d}".format(int(self.l10n_co_edi_type))

    def l10n_co_edi_generate_electronic_invoice_xml(self):
        self.ensure_one()
        if self.state != 'posted':
            raise UserError(_('Can not generate electronic invoice for %s (id: %s) because it is not validated.') % (self.partner_id.display_name, self.id))
        return self._l10n_co_edi_generate_xml()

    def _l10n_co_edi_generate_electronic_invoice_filename(self):
        '''Generates the filename for the XML sent to Carvajal. A separate
        sequence is used because Carvajal requires the invoice number
        to only contain digits.
        '''
        self.ensure_one()
        SEQUENCE_CODE = 'l10n_co_edi.filename'
        IrSequence = self.env['ir.sequence'].with_company(self.company_id)
        invoice_number = IrSequence.next_by_code(SEQUENCE_CODE)

        # if a sequence does not yet exist for this company create one
        if not invoice_number:
            IrSequence.sudo().create({
                'name': 'Colombian electronic invoicing sequence for company %s' % self.company_id.id,
                'code': SEQUENCE_CODE,
                'implementation': 'no_gap',
                'padding': 10,
                'number_increment': 1,
                'company_id': self.company_id.id,
            })
            invoice_number = IrSequence.next_by_code(SEQUENCE_CODE)

        self.l10n_co_edi_invoice_name = 'face_{}{:0>10}{:010x}.xml'.format(self._l10n_co_edi_get_electronic_invoice_type(),
                                                                           self.company_id.vat,
                                                                           int(invoice_number))
        return self.l10n_co_edi_invoice_name

    def _l10n_co_edi_create_carvajal_request(self):
        self.ensure_one()
        company = self.company_id
        l10n_edi_carvajal_wsdl = self.env['ir.config_parameter'].sudo().get_param('l10n_edi_carvajal_wsdl')
        if l10n_edi_carvajal_wsdl:
            l10n_edi_carvajal_wsdl = l10n_edi_carvajal_wsdl % ('-stage' if company.l10n_co_edi_test_mode else '')
        l10n_co_edi_account = company.sudo().l10n_co_edi_account or ''
        if self.move_type in ('in_refund', 'in_invoice') and len(l10n_co_edi_account.split('_')) == 2:
            l10n_co_edi_account = l10n_co_edi_account.split('_')[0] + "_DS" + l10n_co_edi_account.split('_')[1]
        return CarvajalRequest(company.sudo().l10n_co_edi_username, company.sudo().l10n_co_edi_password,
                               company.l10n_co_edi_company, l10n_co_edi_account,
                               company.l10n_co_edi_test_mode, l10n_edi_carvajal_wsdl)

    def _l10n_co_edi_get_delivery_date(self):
        return self.invoice_date + timedelta(1)

    def l10n_co_edi_upload_electronic_invoice(self):
        '''Main function that prepares the XML, uploads it to Carvajal and
        deals with the output. This output is posted as chatter
        messages.

        Few checks performed before sending the electronic invoice to Carvajal.
        '''
        now = fields.Datetime.now()
        oldest_date = now - timedelta(days=5)
        newest_date = now + timedelta(days=10)
        to_process = self.filtered(lambda move: move._l10n_co_edi_is_l10n_co_edi_required())
        if to_process:
            if to_process.filtered(lambda m: not m.partner_id.vat):
                raise UserError(_('You can not validate an invoice that has a partner without VAT number.'))
            if to_process.filtered(lambda m: (not m.partner_id.l10n_co_edi_obligation_type_ids and not m.partner_id.type == 'invoice') or \
                    (m.partner_id.type == 'invoice' and not m.partner_id.commercial_partner_id.l10n_co_edi_obligation_type_ids)):
                raise UserError(_('All the information on the Customer Fiscal Data section needs to be set.'))
            for invoice in to_process:
                if invoice.invoice_date and not (oldest_date <= fields.Datetime.to_datetime(invoice.invoice_date) <= newest_date):
                    invoice.message_post(body=_('The issue date can not be older than 5 days or more than 5 days in the future'))
                # TODO: Add check for unspsc_code_id attribute, once 'UNSPSC product codes' module is ready.
                if (invoice.l10n_co_edi_type == '2' and \
                    any(l.product_id and not l.product_id.l10n_co_edi_customs_code for l in invoice.invoice_line_ids)) \
                    or (any(l.product_id and not l.product_id.default_code and \
                        not l.product_id.barcode for l in invoice.invoice_line_ids)):
                    raise UserError(_( \
                        'Every product on a line should at least have a product code (barcode, internal) set.'))
                try:
                    xml_filename = invoice._l10n_co_edi_generate_electronic_invoice_filename()
                    invoice.write({'l10n_co_edi_datetime_invoice': now})
                    xml = invoice.l10n_co_edi_generate_electronic_invoice_xml()
                    request = invoice._l10n_co_edi_create_carvajal_request()
                    response = request.upload(xml_filename, xml)
                except CarvajalException as e:
                    invoice.message_post(body=_('Electronic invoice submission failed. Message from Carvajal:<br/>%s', e),
                                         attachments=[(xml_filename, xml)])
                except requests.HTTPError as e:
                    if e.response.status_code == 503:
                        raise UserError(_("The invoice wasn't sent to Carvajal as their service is probably not available."))
                    raise UserError(e)
                except (requests.ConnectionError, requests.Timeout) as e:
                    raise UserError(_("The invoice can not be validated as Carvajal servers are not available. Please contact Carvajal's support if this happens unexpectedly."))
                else:
                    invoice.message_post(body=_('Electronic invoice submission succeeded. Message from Carvajal:<br/>%s', response['message']),
                                         attachments=[(xml_filename, xml)])
                    invoice.l10n_co_edi_transaction = response['transactionId']
                    invoice.l10n_co_edi_invoice_status = 'processing'

    def l10n_co_edi_download_electronic_invoice(self):
        '''Downloads a ZIP containing an official XML and signed PDF
        document. This will only be available for invoices that have
        been successfully validated by Carvajal and the government.

        Method called by the user to download the response from the
        processing of the invoice by the DIAN and also get the CUFE
        signature out of that file.
        '''
        carvajal_type = self._l10n_co_edi_get_carvajal_type()
        prefix = self.sequence_prefix
        if self.move_type == 'out_invoice' and self.l10n_co_edi_debit_note:
            prefix = 'ND'
        try:
            request = self._l10n_co_edi_create_carvajal_request()
            response = request.download(prefix, self.name, carvajal_type)
        except CarvajalException as e:
            invoice_download_msg = _('Electronic invoice download failed. Message from Carvajal:<br/>%s', e)
            attachments = []
        except requests.HTTPError as e:
            if e.response.status_code == 503:
                raise UserError(_("The invoice wasn't sent to Carvajal as their service is probably not available."))
            raise UserError(e)
        else:
            invoice_download_msg = _('Electronic invoice download succeeded. Message from Carvajal:<br/>%s', response['message'])
            attachments = [('%s.zip' % self.name, response['zip_b64'])]
        if attachments:
            with tools.osutil.tempdir() as file_dir:
                zip_ref = zipfile.ZipFile(io.BytesIO(attachments[0][1]))
                zip_ref.extractall(file_dir)
                xml_file = [f for f in listdir(file_dir) if f.endswith('.xml')]
                if xml_file:
                    content = xml.dom.minidom.parseString(zip_ref.read(xml_file[0]))
                    element = content.getElementsByTagName('cbc:UUID')
                    if element:
                        self.l10n_co_edi_cufe_cude_ref = element[0].childNodes[0].nodeValue
        return (invoice_download_msg, attachments)

    def l10n_co_edi_check_status_electronic_invoice(self):
        '''This checks the current status of an uploaded XML with Carvajal. It
        posts the results in the invoice chatter and also attempts to
        download a ZIP containing the official XML and PDF if the
        invoice is reported as fully validated.
        '''
        for invoice in self.filtered('l10n_co_edi_transaction'):
            try:
                request = invoice._l10n_co_edi_create_carvajal_request()
                response = request.check_status(invoice.l10n_co_edi_transaction)
            except CarvajalException as e:
                invoice.message_post(body=_('Electronic invoice status check failed. Message from Carvajal:<br/>%s', e))
            except requests.HTTPError as e:
                if e.response.status_code == 503:
                    raise UserError(_("The invoice wasn't sent to Carvajal as their service is probably not available."))
                raise UserError(e)
            else:
                if response['status'] == 'PROCESSING':
                    invoice.l10n_co_edi_invoice_status = 'processing'
                else:
                    invoice.l10n_co_edi_invoice_status = 'accepted' if response['legalStatus'] == 'ACCEPTED' else 'rejected'

                msg = _('Electronic invoice status check completed. Message from Carvajal:<br/>Status: %s', response['status'])
                attachments = []

                if response['errorMessage']:
                    msg += _('<br/>Error message: %s', response['errorMessage'].replace('\n', '<br/>'))
                if response['legalStatus']:
                    msg += _('<br/>Legal status: %s', response['legalStatus'])
                if response['governmentResponseDescription']:
                    msg += _('<br/>Government response: %s', response['governmentResponseDescription'])

                if invoice.l10n_co_edi_invoice_status == 'accepted':
                    invoice_download_msg, attachments = invoice.l10n_co_edi_download_electronic_invoice()
                    msg += '<br/><br/>' + invoice_download_msg

                invoice.message_post(body=msg, attachments=attachments)

    @api.model
    def _l10n_co_edi_check_processing_invoices(self):
        self.search([('l10n_co_edi_invoice_status', '=', 'processing')]).l10n_co_edi_check_status_electronic_invoice()
        return True

    def _l10n_co_edi_get_edi_description(self):
        if self.move_type in ('out_refund', 'in_refund'):
            return dict(DESCRIPTION_CREDIT_CODE).get(self.l10n_co_edi_description_code_credit)
        if self.move_type in ('out_invoice', 'in_invoice') and self.l10n_co_edi_debit_note:
            return dict(DESCRIPTION_DEBIT_CODE).get(self.l10n_co_edi_description_code_debit)

    def _l10n_co_edi_get_edi_description_code(self):
        if self.move_type in ('out_refund', 'in_refund'):
            return self.l10n_co_edi_description_code_credit
        if self.move_type in ('out_invoice', 'in_invoice') and self.l10n_co_edi_debit_note:
            return self.l10n_co_edi_description_code_debit

    def _l10n_co_edi_get_validation_time(self):
        '''Times should always be reported to Carvajal in Colombian time. This
        converts the validation time to that timezone.
        '''
        validation_time = self.l10n_co_edi_datetime_invoice
        validation_time = pytz.utc.localize(validation_time)

        bogota_tz = pytz.timezone('America/Bogota')
        validation_time = validation_time.astimezone(bogota_tz)

        return validation_time.strftime(DEFAULT_SERVER_TIME_FORMAT) + "-05:00"

    def _l10n_co_edi_get_partner_type(self, partner_id):
        if partner_id.is_company:
            return '1'
        else:
            return '2'

    def _l10n_co_edi_get_regime_code(self):
        return '0' if self.partner_id.commercial_partner_id.l10n_co_edi_simplified_regimen else '2'

    def _l10n_co_edi_get_sender_type_of_contact(self):
        return '2' if self.partner_id.commercial_partner_id.type == 'delivery' else '1'

    def _l10n_co_edi_get_total_units(self):
        '''Units have to be reported as units (not e.g. boxes of 12).'''
        lines = self.invoice_line_ids.filtered(lambda line: line.product_uom_id.category_id == self.env.ref('uom.product_uom_categ_unit'))
        units = 0

        for line in lines:
            units += line.product_uom_id._compute_quantity(line.quantity, self.env.ref('uom.product_uom_unit'))

        return int(units)

    def _l10n_co_edi_get_total_weight(self):
        '''Weight has to be reported in kg (not e.g. g).'''
        lines = self.invoice_line_ids.filtered(lambda line: line.product_uom_id.category_id == self.env.ref('uom.product_uom_categ_kgm'))
        kg = 0

        for line in lines:
            kg += line.product_uom_id._compute_quantity(line.quantity, self.env.ref('uom.product_uom_kgm'))

        return int(kg)

    def _l10n_co_edi_get_total_volume(self):
        '''Volume has to be reported in l (not e.g. ml).'''
        lines = self.invoice_line_ids.filtered(lambda line: line.product_uom_id.category_id == self.env.ref('uom.product_uom_categ_vol'))
        l = 0

        for line in lines:
            l += line.product_uom_id._compute_quantity(line.quantity, self.env.ref('uom.product_uom_litre'))

        return int(l)

    def _l10n_co_edi_get_notas(self):
        '''This generates notes in a particular format. These notes are pieces
        of text that are added to the PDF in various places. |'s are
        interpreted as newlines by Carvajal. Each note is added to the
        XML as follows:

        <NOT><NOT_1>text</NOT_1></NOT>

        One might wonder why Carvajal uses this arbitrary format
        instead of some extra simple XML tags but such questions are best
        left to philosophers, not dumb developers like myself.
        '''
        if self.move_type in ('in_invoice', 'in_refund'):
            company_partner = self.company_id.partner_id
            invoice_partner = self.partner_id.commercial_partner_id
            return [
                '23.-%s' % ("|".join([
                                    company_partner.street or '',
                                    company_partner.city or '',
                                    company_partner.country_id.name or '',
                                    company_partner.phone or '',
                                    company_partner.email or '',
                                ])),
                '24.-%s' % ("|".join([invoice_partner.phone or '',
                                    invoice_partner.ref or '',
                                    invoice_partner.email or '',
                                ])),
            ]
        withholding_amount = self.amount_untaxed + sum(self.line_ids.filtered(lambda move: move.tax_line_id and not move.tax_line_id.l10n_co_edi_type.retention).mapped('price_total'))
        amount_in_words = self.currency_id.with_context(lang=self.partner_id.lang or 'es_ES').amount_to_text(withholding_amount)
        shipping_partner = self.env['res.partner'].browse(self._get_invoice_delivery_partner_id())
        narration = ((self.narration and self.narration + ' ' or '') +  (self.invoice_origin or ''))
        notas = [
            '1.-%s|%s|%s|%s|%s|%s' % (self.company_id.l10n_co_edi_header_gran_contribuyente or '',
                                      self.company_id.l10n_co_edi_header_tipo_de_regimen or '',
                                      self.company_id.l10n_co_edi_header_retenedores_de_iva or '',
                                      self.company_id.l10n_co_edi_header_autorretenedores or '',
                                      self.company_id.l10n_co_edi_header_resolucion_aplicable or '',
                                      self.company_id.l10n_co_edi_header_actividad_economica or ''),
            '2.-%s' % (self.company_id.l10n_co_edi_header_bank_information or '').replace('\n', '|'),
            ('3.- %s' % (narration or 'N/A'))[:5000],
            '6.- %s|%s' % (self.invoice_payment_term_id.note, amount_in_words),
            '7.- %s' % (self.company_id.website),
            '8.-%s|%s|%s' % (self.partner_id.commercial_partner_id._get_vat_without_verification_code() or '', shipping_partner.phone or '', self.invoice_origin and self.invoice_origin.split(',')[0] or ''),
            '10.- | | | |%s' % (self.invoice_origin and self.invoice_origin.split(',')[0] or 'N/A'),
            '11.- |%s| |%s|%s' % (self._l10n_co_edi_get_total_units(), self._l10n_co_edi_get_total_weight(), self._l10n_co_edi_get_total_volume())
        ]

        return notas

    def _l10n_co_edi_get_electronic_invoice_type(self):
        if self.move_type == 'out_invoice':
            return 'ND' if self.l10n_co_edi_debit_note else 'INVOIC'
        elif self.move_type == 'in_invoice':
            return 'DS'
        return 'NC'

    def _l10n_co_edi_get_electronic_invoice_type_info(self):
        if self.move_type == 'out_invoice':
            return 'DIAN 2.1: Nota Débito de Factura Electrónica de Venta' if self.l10n_co_edi_debit_note else 'DIAN 2.1: Factura Electrónica de Venta'
        elif self.move_type == 'in_invoice':
            return 'DIAN 2.1: documento soporte en adquisiciones efectuadas a no obligados a facturar.'
        elif self.move_type == 'in_refund':
            return 'DIAN 2.1: Nota de ajuste al documento soporte en adquisiciones efectuadas a sujetos no obligados a expedir factura o documento equivalente'
        return 'DIAN 2.1: Nota Crédito de Factura Electrónica de Venta'

    def _l10n_co_edi_get_carvajal_code_for_identification_type(self, partner):
        IDENTIFICATION_TYPE_TO_CARVAJAL_CODE = {
            'rut': '31',
            'id_document': '',
            'id_card': '12',
            'passport': '41',
            'foreign_id_card': '42',
            'external_id': '50',
            'residence_document': 'O-99',
            'civil_registration': '11',
            'national_citizen_id': '13',
            'niup_id': '91',
            'foreign_colombian_card': '21',
            'foreign_resident_card': '22',
            'diplomatic_card': 'O-99',
        }

        identification_type = partner.l10n_latam_identification_type_id.l10n_co_document_code
        return IDENTIFICATION_TYPE_TO_CARVAJAL_CODE[identification_type] if identification_type else ''

    def _l10n_co_edi_get_round_amount(self, amount):
        if abs(amount - float("%.2f" % amount)) > 0.00001:
            return "%.3f" % amount
        return '%.2f' % amount

    def _l10n_co_edi_prepare_tim_sections(self, taxes_dict, retention, zero_taxes=None):
        @lru_cache(maxsize=None)
        def _get_conversion_rate(from_currency, to_currency, company, date):
            if from_currency == to_currency:
                return 1
            currency_rates = (from_currency + to_currency)._get_rates(company, date)
            return currency_rates.get(to_currency.id) / currency_rates.get(from_currency.id)

        def _convert(from_currency, from_amount, to_currency, company, date):
            return to_currency.round(from_amount * _get_conversion_rate(from_currency, to_currency, company, date))

        new_taxes_dict = defaultdict(list)
        zero_taxes = zero_taxes or {}
        for tax_code, values in taxes_dict.items():
            tim = {
                'TIM_1': bool(retention),
                'TIM_2': 0.0,
                'TIM_3': self.currency_id.name,
                'TIM_4': 0.0,
                'TIM_5': self.currency_id.name,
                'IMPS': [],
            }
            for rec in values:
                imp = {
                    'IMP_1': tax_code,
                    'IMP_2': (
                        abs((rec.amount_currency or rec.balance) * 100 / 15)
                        if rec.tax_line_id.l10n_co_edi_type.code == '05' else
                        _convert(rec.company_id.currency_id, rec.tax_base_amount, rec.currency_id, rec.company_id, rec.move_id.invoice_date)
                    ),
                    'IMP_3': self.currency_id.name,
                    'IMP_4': abs(rec.amount_currency or rec.balance),
                    'IMP_5': self.currency_id.name,
                }
                if rec.tax_line_id.amount_type == 'fixed':
                    imp.update({
                        'IMP_6': 0,
                        'IMP_7': 1,
                        'IMP_8': 'BO' if rec.tax_line_id.l10n_co_edi_type.code == '22' else '94',
                        'IMP_9': rec.tax_line_id.amount,
                        'IMP_10': self.currency_id.name,
                    })
                else:
                    imp.update({
                        'IMP_6': 15.0 if rec.tax_line_id.l10n_co_edi_type.code == '05' else abs(rec.tax_line_id.amount),
                        'IMP_7': '',
                        'IMP_8': '',
                        'IMP_9': '',
                        'IMP_10': '',
                    })
                    tim['TIM_4'] += (imp['IMP_6'] / 100.0 * imp['IMP_2']) - imp['IMP_4']
                tim['TIM_2'] += imp['IMP_4']
                tim['IMPS'].append(imp)
            if zero_taxes.get(tax_code):
                tim['IMPS'].append({
                    'IMP_1': tax_code,
                    'IMP_2': zero_taxes[tax_code],
                    'IMP_3': self.currency_id.name,
                    'IMP_4': 0,
                    'IMP_5': self.currency_id.name,
                    'IMP_6': 0,
                    'IMP_7': '',
                    'IMP_8': '',
                    'IMP_9': '',
                    'IMP_10': '',
                })
                zero_taxes.pop(tax_code)
            new_taxes_dict[tax_code] = tim
        for tax_code, values in zero_taxes.items():
            new_taxes_dict[tax_code] = {
                'TIM_1': bool(retention),
                'TIM_2': 0,
                'TIM_3': self.currency_id.name,
                'TIM_4': 0,
                'TIM_5': self.currency_id.name,
                'IMPS': [{
                    'IMP_1': tax_code,
                    'IMP_2': zero_taxes[tax_code],
                    'IMP_3': self.currency_id.name,
                    'IMP_4': 0,
                    'IMP_5': self.currency_id.name,
                    'IMP_6': 0,
                    'IMP_7': '',
                    'IMP_8': '',
                    'IMP_9': '',
                    'IMP_10': ''
                }]
            }
        return new_taxes_dict

    def _l10n_co_edi_generate_xml(self):
        '''Renders the XML that will be sent to Carvajal.'''
        # generate xml with strings in language of customer
        self = self.with_context(lang=self.partner_id.lang)

        code_to_filter = ['07', 'ZZ'] if self.move_type in ('in_invoice', 'in_refund') else ['ZZ']
        move_lines_with_tax_type = self.line_ids.filtered(lambda l: l.tax_line_id.l10n_co_edi_type.code not in [False] + code_to_filter)
        ovt_tax_codes = ('01C', '02C', '03C')
        ovt_taxes = move_lines_with_tax_type.filtered(lambda move: move.tax_line_id.l10n_co_edi_type.code in ovt_tax_codes).mapped('tax_line_id')

        invoice_type_to_ref_1 = {
            'out_invoice': 'IV',
            'out_refund': 'NC',
        }
        tax_types = self.mapped('line_ids.tax_ids.l10n_co_edi_type')

        taxes_amount_dict = {}
        exempt_tax_dict = {}
        tax_group_covered_goods = self.env.ref('l10n_co.tax_group_covered_goods', raise_if_not_found=False)
        zero_taxes = defaultdict(float)
        for line in self.invoice_line_ids:
            price_unit = line.price_unit * (1 - (line.discount or 0.0) / 100.0)
            taxes = line.tax_ids.with_context(force_sign=line.move_id._get_tax_force_sign()).filtered(lambda l: l.l10n_co_edi_type.code not in code_to_filter).compute_all(price_unit, quantity=line.quantity, currency=line.currency_id,
                                             product=line.product_id, partner=line.partner_id)
            taxes_amount_dict[line.id] = []

            for tax in taxes['taxes']:
                tax_rec = self.env['account.tax'].browse(tax['id'])
                if tax['amount'] == 0.0:
                    zero_taxes[tax_rec.l10n_co_edi_type.code] += tax['base']
                taxes_amount_dict[line.id].append({'base': "%.2f" % tax['base'],
                                                   'tax': tax['amount'],
                                                   'code': tax_rec.l10n_co_edi_type.code,
                                                   'retention': tax_rec.l10n_co_edi_type.retention,
                                                   'rate': tax_rec.amount,
                                                   'amount_type': tax_rec.amount_type})
            if tax_group_covered_goods and tax_group_covered_goods in line.mapped('tax_ids.tax_group_id'):
                exempt_tax_dict[line.id] = True

        retention_lines = move_lines_with_tax_type.filtered(
            lambda move: move.tax_line_id.l10n_co_edi_type.retention)
        retention_lines_dict = {}  # TODO remove, kept for stable policy
        retention_lines_listdict = defaultdict(list)
        for line in retention_lines:
            retention_lines_listdict[line.tax_line_id.l10n_co_edi_type.code].append(line)
            retention_lines_dict[line.tax_line_id.l10n_co_edi_type] = line
        retention_lines_dict_new = self._l10n_co_edi_prepare_tim_sections(retention_lines_listdict, True)

        regular_lines = move_lines_with_tax_type - retention_lines
        regular_lines_dict = {}  # TODO remove, kept for stable policy
        regular_lines_listdict = defaultdict(list)
        for line in regular_lines:
            regular_lines_listdict[line.tax_line_id.l10n_co_edi_type.code].append(line)
            regular_lines_dict[line.tax_line_id.l10n_co_edi_type] = line
        regular_lines_dict_new = self._l10n_co_edi_prepare_tim_sections(regular_lines_listdict, False, zero_taxes)

        # The rate should indicate how many pesos is one foreign currency
        currency_rate = "%.2f" % (1.0 / self.currency_id.with_context(date=self.invoice_date or fields.Date.today()).rate)

        withholding_amount = '%.2f' % (self.amount_untaxed + sum(self.line_ids.filtered(lambda move: move.tax_line_id and not move.tax_line_id.l10n_co_edi_type.retention).mapped('price_total')))
        xml_content = self._l10n_co_edi_get_electronic_invoice_template()._render({
            'invoice': self,
            'company_partner': self.company_id.partner_id,
            'sales_partner': self.user_id,
            'invoice_partner': self.partner_id.commercial_partner_id,
            'retention_lines_dict': retention_lines_dict,
            'retention_lines_dict_new': retention_lines_dict_new,
            'regular_lines_dict': regular_lines_dict,
            'regular_lines_dict_new': regular_lines_dict_new,
            'tax_types': tax_types,
            'exempt_tax_dict': exempt_tax_dict,
            'currency_rate': currency_rate,
            'shipping_partner': self.env['res.partner'].browse(self._get_invoice_delivery_partner_id()),
            'invoice_type_to_ref_1': invoice_type_to_ref_1,
            'ovt_taxes': ovt_taxes,
            'float_compare': float_compare,
            'notas': self._l10n_co_edi_get_notas(),
            'taxes_amount_dict': taxes_amount_dict,
            'withholding_amount': withholding_amount,
            '_l10n_co_edi_get_round_amount': self._l10n_co_edi_get_round_amount,
        })
        return '<?xml version="1.0" encoding="utf-8"?>'.encode() + xml_content

    def _l10n_co_edi_get_electronic_invoice_template(self):
        if self.move_type in ('in_invoice', 'in_refund'):
            return self.env.ref('l10n_co_edi.electronic_invoice_vendor_document_xml')
        return self.env.ref('l10n_co_edi.electronic_invoice_xml')

    def _l10n_co_edi_get_carvajal_type(self):
        if self.move_type == 'out_refund':
            return 'NC'
        elif self.move_type == 'out_invoice':
            if self.l10n_co_edi_debit_note or self.l10n_co_edi_operation_type in ['30', '32', '33']:
                return 'ND'
            else:
                odoo_type_to_carvajal_type = {
                    '1': 'FV',
                    '2': 'FE',
                    '3': 'FC',
                    '4': 'FC',
                }
                return odoo_type_to_carvajal_type[self.l10n_co_edi_type]
        elif self.move_type == 'in_invoice':
            return 'DS'
        elif self.move_type == 'in_refund':
            return 'NS'

    def _l10n_co_edi_is_l10n_co_edi_required(self):
        self.ensure_one()
        if self.move_type in ('in_invoice', 'in_refund'):
            return self.env.ref('l10n_co_edi.electronic_invoice_vendor_document_xml', False) and self.company_id.country_id.code == "CO" and self.l10n_co_edi_is_support_document
        return self.move_type in ('out_invoice', 'out_refund') and self.company_id.country_id.code == "CO"

    def _post(self, soft=True):
        # OVERRIDE to generate the e-invoice for the Colombian Localization.
        posted = super(AccountMove, self)._post(soft)

        to_process = posted.filtered(lambda move: move._l10n_co_edi_is_l10n_co_edi_required())
        if to_process:
            to_process.write({'l10n_co_edi_datetime_invoice': fields.Datetime.now()})
            to_process.l10n_co_edi_upload_electronic_invoice()
        return posted

    def _l10n_co_edi_get_company_address(self, partner):
        """
        Function forms address of the company avoiding duplicity. contact_address attribute holds the complete address
        of company, which should not be used.
        Information like city, state which is already sent in other tags should be excluded from the company's address.
        """
        return '%s %s' % (partner.street or '', partner.street2 or '')


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def _l10n_co_edi_get_product_code(self):
        """
        For identifying products, different standards can be used.  If there is a barcode, we take that one, because
        normally in the GTIN standard it will be the most specific one.  Otherwise, we will check the
        :return: (standard, product_code)
        """
        self.ensure_one()
        if self.product_id:
            if self.move_id.l10n_co_edi_type == '2':
                if not self.product_id.l10n_co_edi_customs_code:
                    raise UserError(_('Exportation invoices require custom code in all the products, please fill in this information before validating the invoice'))
                return (self.product_id.l10n_co_edi_customs_code, '020', 'Partida Alanceraria')
            if self.product_id.barcode:
                return (self.product_id.barcode, '010', 'GTIN')
            elif self.product_id.unspsc_code_id:
                return (self.product_id.unspsc_code_id.code, '001', 'UNSPSC')
            elif self.product_id.default_code:
                return (self.product_id.default_code, '999', 'Estándar de adopción del contribuyente')

        return ('1010101', '001', '')

    def _l10n_co_edi_get_iae3_value(self, product_code):
        value = {
            '010': '9',
            '001': '10',
        }
        return value.get(product_code, '')
