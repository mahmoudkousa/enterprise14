# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class HrPayroll28110Wizard(models.TransientModel):
    _name = 'hr.payroll.281.10.wizard'
    _description = 'HR Payroll 281.10 Wizard'
    _inherit = 'hr.payroll.281.base.wizard'

    def _get_years(self):
        return [(str(i), i) for i in range(fields.Date.today().year - 1, 2009, -1)]

    reference_year = fields.Selection(
        selection='_get_years', string='Reference Year', required=True,
        default=lambda x: str(fields.Date.today().year - 1))
    is_test = fields.Boolean(string="Is It a test ?", default=False)
    type_sending = fields.Selection([
        ('0', 'Original send'),
        ('1', 'Send grouped corrections'),
        ], string="Sending Type", default='0', required=True)
    type_treatment = fields.Selection([
        ('0', 'Original'),
        ('1', 'Modification'),
        ('2', 'Add'),
        ('3', 'Cancel'),
        ], string="Treatment Type", default='0', required=True)
    pdf_file = fields.Binary('PDF File', readonly=True, attachment=False)
    xml_file = fields.Binary('XML File', readonly=True, attachment=False)
    pdf_filename = fields.Char()
    xml_filename = fields.Char()

    def action_generate_files(self, file_type=['pdf', 'xml']):
        basic_info = {
            'year': self.reference_year,
            'is_test': self.is_test,
            'type_sending': self.type_sending,
            'type_treatment': self.type_treatment,
        }

        files = self.employee_ids._generate_281_10_form(basic_info, file_type)
        pdf_files = files['pdf']
        xml_files = files['xml']

        if pdf_files:
            filename, binary = self._process_files(pdf_files, default_filename='281.10 PDF - %s.zip' % fields.Date.today())
            self.pdf_filename = filename
            self.pdf_file = binary

        if xml_files:
            filename, binary = self._process_files(xml_files, default_filename='281.10 XML - %s.zip' % fields.Date.today())
            self.xml_filename = filename
            self.xml_file = binary

        self.state = 'get'
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'view_mode': 'form',
            'res_id': self.id,
            'views': [(False, 'form')],
            'target': 'new',
        }

    def action_generate_xml(self):
        return self.action_generate_files(file_type=['xml'])

    def action_generate_pdf(self):
        return self.action_generate_files(file_type=['pdf'])
