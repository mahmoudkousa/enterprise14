# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import io
import zipfile

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrPayroll281BaseWizard(models.AbstractModel):
    _name = 'hr.payroll.281.base.wizard'
    _description = 'HR Payroll 281 Base Wizard'

    @api.model
    def default_get(self, field_list):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        defaults = super().default_get(field_list)
        if 'employee_ids' in field_list and 'employee_ids' not in defaults:
            defaults['employee_ids'] = [(6, 0, self.env.context.get('active_ids'))]
        return defaults

    employee_ids = fields.Many2many('hr.employee', required=True)
    state = fields.Selection([('generate', 'generate'), ('get', 'get')], default='generate')

    def _process_files(self, files, default_filename='281.zip'):
        """Groups files into a single file
        :param files: list of tuple (employee, filename, data)
        :return: tuple filename, encoded data
        """
        if len(files) == 1:
            employee, filename, data = files[0]
            return filename, base64.encodebytes(data)

        else:
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, 'w') as doc_zip:
                for employee, filename, data in files:
                    doc_zip.writestr(filename, data, compress_type=zipfile.ZIP_DEFLATED)

            filename = default_filename
            return filename, base64.encodebytes(stream.getvalue())
