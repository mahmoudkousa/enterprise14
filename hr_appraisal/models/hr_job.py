# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class HrJob(models.Model):
    _inherit = "hr.job"

    employee_feedback_template = fields.Html(
        compute='_compute_appraisal_feedbacks', store=True, readonly=False)
    manager_feedback_template = fields.Html(
        compute='_compute_appraisal_feedbacks', store=True, readonly=False)

    @api.depends('company_id')
    def _compute_appraisal_feedbacks(self):
        for job in self:
            job.employee_feedback_template = job.company_id.appraisal_employee_feedback_template or self.env.company.appraisal_employee_feedback_template
            job.manager_feedback_template = job.company_id.appraisal_manager_feedback_template or self.env.company.appraisal_manager_feedback_template
