# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from collections import defaultdict
from lxml import etree

from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
from odoo.modules.module import get_resource_path
from odoo.exceptions import UserError


class HrPayrollWithholdingTaxIPDeclaration(models.TransientModel):
    _name = 'l10n.be.withholding.tax.ip.declaration'
    _description = '273S Sheet'

    @api.model
    def default_get(self, field_list=None):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        return super().default_get(field_list)

    period = fields.Date(
        'Period', required=True,
        default=lambda self: fields.Date.today() + relativedelta(months=-1, day=1),
        help="Period to consider. Only the month and year will be considered.")
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    currency_id = fields.Many2one('res.currency', related='company_id.currency_id')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('waiting', 'Waiting'),
        ('done', 'Done')
    ], default='draft', compute="_compute_state", store=True)

    pdf_file = fields.Binary(string="PDF File")
    pdf_filename = fields.Char("PDF Filename")

    xml_file = fields.Binary(string="XML File")
    xml_filename = fields.Char("XML Filename")
    xml_validation_state = fields.Selection([
        ('normal', 'N/A'),
        ('done', 'Valid'),
        ('invalid', 'Invalid'),
    ], default='normal', compute='_compute_validation_state', store=True)
    error_message = fields.Char('Error Message', compute='_compute_validation_state', store=True)

    @api.depends('xml_file', 'pdf_file', 'xml_validation_state')
    def _compute_state(self):
        for wizard in self:
            state = 'draft'
            if wizard.xml_file and wizard.pdf_file and wizard.xml_validation_state:
                state = 'done'
            elif wizard.xml_file or wizard.pdf_file:
                state = 'waiting'
            wizard.state = state

    @api.depends('xml_file')
    def _compute_validation_state(self):
        xsd_schema_file_path = get_resource_path(
            'l10n_be_hr_payroll_273S_274',
            'data',
            'withholdingTaxDeclarationOriginal_202012.xsd',
        )
        xsd_root = etree.parse(xsd_schema_file_path)
        schema = etree.XMLSchema(xsd_root)

        no_xml_file_wizards = self.filtered(lambda wizard: not wizard.xml_file)
        no_xml_file_wizards.update({
            'xml_validation_state': 'normal',
            'error_message': False})
        for wizard in self - no_xml_file_wizards:
            xml_root = etree.fromstring(base64.b64decode(wizard.xml_file))
            try:
                schema.assertValid(xml_root)
                wizard.xml_validation_state = 'done'
            except etree.DocumentInvalid as err:
                wizard.xml_validation_state = 'invalid'
                wizard.error_message = str(err)

    def _get_rendering_data(self):
        date_from = self.period + relativedelta(day=1)
        date_to = self.period + relativedelta(day=31)
        payslips = self.env['hr.payslip'].search([
            ('state', '=', 'paid'),
            ('company_id', '=', self.company_id.id),
            ('date_from', '>=', date_from),
            ('date_to', '<=', date_to)])
        # The first threshold is at 16320 € of gross IP, so we only consider the rate at 7.5 %. 
        # YTI TODO: Handle different thresholds in master
        gross_amount = sum(p._get_salary_line_total('IP') for p in payslips)
        tax_amount = - sum(p._get_salary_line_total('IP.DED') for p in payslips)

        mapped_ip = defaultdict(lambda: [0, 0])
        for payslip in payslips.sudo():
            mapped_ip[payslip.employee_id][0] += payslip._get_salary_line_total('IP')
            mapped_ip[payslip.employee_id][1] += payslip._get_salary_line_total('IP.DED')

        currency = self.env.company.currency_id

        return {
            'unique_reference': self.id,
            'company_info': {
                'identification': "BE%s" % (self.company_id.l10n_be_company_number),
                'name': self.company_id.name,
                'address': self.company_id.partner_id._display_address(),
                'phone': self.company_id.phone,
                'email': self.company_id.email,
            },
            'period': fields.Date.today(),
            'declaration': {
                'gross_amount': gross_amount,
                'deductable_costs':  {
                    'fixed': gross_amount / 2,
                    'actual': 0,
                },
                'taxable_amount': gross_amount / 2,
                'rate': 15.0,
                'tax_amount': tax_amount,
            },
            'beneficiaries': [
                {
                    'identification': {
                        'nature': "Citizen",
                        'name': employee.name,
                        'street': employee.address_home_id.street,
                        'city': employee.address_home_id.city,
                        'zip': employee.address_home_id.zip,
                        'country': employee.address_home_id.country_id.code,
                        'nationality': employee.country_id.code,
                        'identification': employee.identification_id.replace('-', '').replace('.', ''),
                    },
                    'gross_amount': ip_values[0],
                    'deductable_costs': {
                        'fixed': ip_values[0] / 2,
                        'actual': 0,
                    },
                    'tax_amount': ip_values[1],
                } for employee, ip_values in mapped_ip.items()],
            'to_eurocent': lambda amount: '%s' % int(amount * 100),
            'to_monetary': lambda amount: '%.2f %s' % (amount, currency.symbol),
        }

    def action_generate_pdf(self):
        self.ensure_one()
        export_273S_pdf, export_type = self.env.ref('l10n_be_hr_payroll_273S_274.action_report_ip_273S').sudo()._render_qweb_pdf(res_ids=self.ids, data=self._get_rendering_data())
        self.pdf_filename = '%s-273S_report.pdf' % (self.period.strftime('%B%Y'))
        self.pdf_file = base64.encodebytes(export_273S_pdf)

        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'view_mode': 'form',
            'res_id': self.id,
            'views': [(False, 'form')],
            'target': 'new',
        }

    def action_generate_xml(self):
        self.ensure_one()
        self.xml_filename = '%s-273S_report.xml' % (self.period.strftime('%B%Y'))
        xml_str = self.env.ref('l10n_be_hr_payroll_273S_274.273S_xml_report')._render(self._get_rendering_data())

        # Prettify xml string
        root = etree.fromstring(xml_str, parser=etree.XMLParser(remove_blank_text=True))
        xml_formatted_str = etree.tostring(root, pretty_print=True, encoding='utf-8', xml_declaration=True)

        self.xml_file = base64.encodebytes(xml_formatted_str)

        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'view_mode': 'form',
            'res_id': self.id,
            'views': [(False, 'form')],
            'target': 'new',
        }

    def action_validate(self):
        self.ensure_one()
        return {'type': 'ir.actions.act_window_close'}
