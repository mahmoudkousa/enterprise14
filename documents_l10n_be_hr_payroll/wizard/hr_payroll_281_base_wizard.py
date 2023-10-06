# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64

from odoo import api, fields, models


class HrPayroll281BaseWizard(models.AbstractModel):
    _inherit = 'hr.payroll.281.base.wizard'
    _description = 'HR Payroll 281 Base Wizard'

    documents_enabled = fields.Boolean(compute='_compute_documents_enabled')

    @api.depends('employee_ids.company_id.documents_payroll_folder_id', 'employee_ids.company_id.documents_hr_settings')
    def _compute_documents_enabled(self):
        for wizard in self:
            companies = wizard.employee_ids.company_id
            wizard.documents_enabled = any(
                self._payroll_documents_enabled(company) for company in companies
            )

    @api.model
    def _payroll_documents_enabled(self, company):
        return company.documents_payroll_folder_id and company.documents_hr_settings

    def _process_files(self, files, **kwargs):
        self.env['documents.document'].create([{
                'owner_id': employee.user_id.id,
                'datas': base64.encodebytes(data),
                'name': filename,
                'folder_id': employee.company_id.documents_payroll_folder_id.id,
            }
            for employee, filename, data in files
            if self._payroll_documents_enabled(employee.company_id)
        ])
        return super()._process_files(files, **kwargs)
