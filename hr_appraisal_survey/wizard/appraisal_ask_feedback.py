# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, tools, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class AppraisalAskFeedback(models.TransientModel):
    _name = 'appraisal.ask.feedback'
    _description = "Ask Feedback for Appraisal"

    def _get_default_deadline(self):
        return fields.Date.today() + relativedelta(months=1)

    @api.model
    def default_get(self, fields):
        if not self.env.user.email:
            raise UserError(_("Unable to post message, please configure the sender's email address."))
        result = super(AppraisalAskFeedback, self).default_get(fields)
        appraisal = self.env['hr.appraisal'].browse(result.get('appraisal_id'))
        if 'survey_template_id' in fields and appraisal and not result.get('survey_template_id'):
            result['survey_template_id'] = appraisal.company_id.appraisal_survey_template_id.id
        return result

    appraisal_id = fields.Many2one('hr.appraisal', default=lambda self: self.env.context.get('active_id', None))
    employee_id = fields.Many2one(related='appraisal_id.employee_id', string='Appraisal Employee')
    subject = fields.Char('Subject', compute='_compute_subject', store=True, readonly=False)
    body = fields.Html('Contents', sanitize_style=True, compute='_compute_body', store=True, readonly=False)
    attachment_ids = fields.Many2many(
        'ir.attachment', 'hr_appraisal_survey_mail_compose_message_ir_attachments_rel',
        'wizard_id', 'attachment_id', string='Attachments')
    template_id = fields.Many2one(
        'mail.template', 'Use template', index=True,
        domain="[('model', '=', 'appraisal.ask.feedback')]",
        default=lambda self: self.env.ref('hr_appraisal_survey.mail_template_appraisal_ask_feedback', raise_if_not_found=False),
    )
    email_from = fields.Char(
        'From', required=True,
        default=lambda self: self.env.user.email_formatted,
        help="Email address of the sender",
    )
    author_id = fields.Many2one(
        'res.partner', string='Author', required=True,
        default=lambda self: self.env.user.partner_id.id,
        help="Author of the message.",
    )
    survey_template_id = fields.Many2one('survey.survey')
    employee_ids = fields.Many2many(
        'hr.employee', string="Recipients", domain=[('user_id', '!=', False)])
    deadline = fields.Date(string="Answer Deadline", required=True, default=_get_default_deadline)

    @api.depends('template_id')
    def _compute_subject(self):
        for wizard in self.filtered(lambda w: w.template_id):
            wizard.subject = wizard.template_id.subject

    @api.depends('template_id')
    def _compute_body(self):
        for wizard in self.filtered(lambda w: w.template_id):
            wizard.body = wizard.template_id.body_html

    def _prepare_survey_anwers(self, partners):
        answers = self.env['survey.user_input']
        existing_answers = self.env['survey.user_input'].search([
            '&', '&',
            ('survey_id', '=', self.survey_template_id.id),
            ('appraisal_id', '=', self.appraisal_id.id),
            ('partner_id', 'in', partners.ids),
        ])
        partners_done = self.env['res.partner']
        if existing_answers:
            partners_done = existing_answers.mapped('partner_id')
            # only add the last answer for each partner_id
            # to have only one mail sent per user
            for partner_done in partners_done:
                answers |= next(
                    existing_answer for existing_answer in
                    existing_answers.sorted(lambda answer: answer.create_date, reverse=True)
                    if existing_answer.partner_id == partner_done)

        for new_partner in partners - partners_done:
            answers |= self.survey_template_id.sudo()._create_answer(
                partner=new_partner, check_attempts=False, deadline=self.deadline)
        return answers

    def _send_mail(self, answer):
        """ Create mail specific for recipient containing notably its access token """
        ctx = {'employee_name': self.employee_id.name,}
        RenderMixin = self.env['mail.render.mixin'].with_context(**ctx)
        subject = RenderMixin._render_template(self.subject, 'survey.user_input', answer.ids, post_process=True)[answer.id]
        body = RenderMixin._render_template(self.body, 'survey.user_input', answer.ids, post_process=True)[answer.id]
        # post the message
        mail_values = {
            'email_from': self.email_from,
            'author_id': self.author_id.id,
            'model': None,
            'res_id': None,
            'subject': subject,
            'body_html': body,
            'attachment_ids': [(4, att.id) for att in self.attachment_ids],
            'auto_delete': True,
        }
        if answer.partner_id:
            mail_values['recipient_ids'] = [(4, answer.partner_id.id)]
        else:
            mail_values['email_to'] = answer.email

        try:
            template = self.env.ref('mail.mail_notification_light', raise_if_not_found=True)
        except ValueError:
            _logger.warning('QWeb template mail.mail_notification_light not found when sending appraisal feedback mails. Sending without layouting.')
        else:
            template_ctx = {
                'message': self.env['mail.message'].sudo().new(dict(body=mail_values['body_html'], record_name=self.survey_template_id.title)),
                'model_description': self.env['ir.model']._get('appraisal.ask.feedback').display_name,
                'company': self.env.company,
            }
            body = template._render(template_ctx, engine='ir.qweb', minimal_qcontext=True)
            mail_values['body_html'] = self.env['mail.render.mixin']._replace_local_links(body)

        return self.env['mail.mail'].sudo().create(mail_values)

    def action_send(self):
        self.ensure_one()
        partners = self.employee_ids.mapped('user_id.partner_id')

        answers = self._prepare_survey_anwers(partners)
        answers.sudo().write({'appraisal_id': self.appraisal_id.id})
        for answer in answers:
            self._send_mail(answer)

        for employee in self.employee_ids.filtered(lambda e: e.user_id):
            answer = answers.filtered(lambda l: l.partner_id == employee.user_id.partner_id)
            self.appraisal_id.with_context(mail_activity_quick_update=True).activity_schedule(
                'mail.mail_activity_data_todo', self.deadline,
                summary=_('Fill the feedback form on survey'),
                note=_('An appraisal feedback was requested. Please take time to fill the <a href="%s" target="_blank">survey</a>') %
                    answer.get_start_url(),
                user_id=employee.user_id.id)

        self.appraisal_id.employee_feedback_ids |= self.employee_ids
        return {'type': 'ir.actions.act_window_close'}
