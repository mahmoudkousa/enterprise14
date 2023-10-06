# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResCompany(models.Model):
    _inherit = "res.company"

    def _get_default_employee_feedback_template(self):
        return """
<p>
    <b>Does my company recognize my value ?</b><br/><br/>
    <b>What are the elements that would have the best impact on my work performance?</b><br/><br/>
    <b>What are my best achievement(s) since my last appraisal?</b><br/><br/>
    <b>What do I like / dislike about my job, the company or the management?</b><br/><br/>
    <b>How can I improve (skills, attitude, etc)?</b><br/><br/>
</p>"""

    def _get_default_manager_feedback_template(self):
        return """
<p>
    <b>What are the responsibilities that the employee performs effectively?</b><br/><br/>
    <b>How could the employee improve?</b><br/><br/>
    <b>Short term (6-months) actions / decisions / objectives</b><br/><br/>
    <b>Long term (>6months) career discussion, where does the employee want to go, how to help him reach this path?</b><br/><br/>
</p>"""

    def _get_default_appraisal_confirm_employee_mail_template(self):
        return self.env.ref('hr_appraisal.mail_template_appraisal_confirm_employee', raise_if_not_found=False)

    def _get_default_appraisal_confirm_manager_mail_template(self):
        return self.env.ref('hr_appraisal.mail_template_appraisal_confirm_manager', raise_if_not_found=False)

    appraisal_plan = fields.Boolean(string='Automatically Generate Appraisals', default=True)
    appraisal_plan_ids = fields.One2many(
        'hr.appraisal.plan', 'company_id', string='Appraisal Plan',
        copy=True, groups="base.group_system")
    assessment_note_ids = fields.One2many('hr.appraisal.note', 'company_id')
    appraisal_employee_feedback_template = fields.Html(default=_get_default_employee_feedback_template)
    appraisal_manager_feedback_template = fields.Html(default=_get_default_manager_feedback_template)
    appraisal_confirm_employee_mail_template = fields.Many2one(
        'mail.template', domain="[('model', '=', 'hr.appraisal')]",
        default=_get_default_appraisal_confirm_employee_mail_template)
    appraisal_confirm_manager_mail_template = fields.Many2one(
        'mail.template', domain="[('model', '=', 'hr.appraisal')]",
        default=_get_default_appraisal_confirm_manager_mail_template)

    @api.model
    def _get_default_assessment_note_ids(self):
        return [
            (0, 0, {'name': _('Needs improvement'), 'sequence': '1'}),
            (0, 0, {'name': _('Meets expectations'), 'sequence': '2'}),
            (0, 0, {'name': _('Exceeds expectations'), 'sequence': '3'}),
            (0, 0, {'name': _('Strongly Exceed Expectations'), 'sequence': '4'}),
        ]

    @api.model_create_multi
    def create(self, vals_list):
        res = super().create(vals_list)
        default_notes = self._get_default_assessment_note_ids()
        res.sudo().write({'assessment_note_ids': default_notes})
        return res
