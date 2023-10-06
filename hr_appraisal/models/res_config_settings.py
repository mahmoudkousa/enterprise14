# -*- coding: utf-8 -*-

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    appraisal_plan = fields.Boolean(related='company_id.appraisal_plan', readonly=False)
    assessment_note_ids = fields.One2many(
        related='company_id.assessment_note_ids', string="Evaluation Scale", readonly=False)
    appraisal_employee_feedback_template = fields.Html(related='company_id.appraisal_employee_feedback_template', readonly=False)
    appraisal_manager_feedback_template = fields.Html(related='company_id.appraisal_manager_feedback_template', readonly=False)
    appraisal_confirm_employee_mail_template = fields.Many2one('mail.template', related='company_id.appraisal_confirm_employee_mail_template', readonly=False)
    appraisal_confirm_manager_mail_template = fields.Many2one('mail.template', related='company_id.appraisal_confirm_manager_mail_template', readonly=False)

    module_hr_appraisal_survey = fields.Boolean(string="360 Feedback")
