# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, fields, models, tools, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class RequestAppraisal(models.TransientModel):
    _name = 'request.appraisal'
    _description = "Request an Appraisal"

    @api.model
    def default_get(self, fields):
        if not self.env.user.email:
            raise UserError(_("Unable to post message, please configure the sender's email address."))
        result = super(RequestAppraisal, self).default_get(fields)
        if not set(fields) & set(['employee_id', 'template_id', 'recipient_ids']):
            return result
        if self.env.context.get('active_model') in ('hr.employee', 'hr.employee.public'):
            employee = self.env['hr.employee'].browse(self.env.context['active_id'])
            manager = employee.parent_id
            if manager.user_id == self.env.user:
                template = self.env.ref('hr_appraisal.mail_template_appraisal_request', raise_if_not_found=False)
                recipients = self._get_recipients(employee)
            elif employee.user_id == self.env.user:
                template = self.env.ref('hr_appraisal.mail_template_appraisal_request_from_employee', raise_if_not_found=False)
                recipients = self._get_recipients(manager)
            else:
                template = self.env.ref('hr_appraisal.mail_template_appraisal_request', raise_if_not_found=False)
                recipients = self._get_recipients(employee | manager)

            result.update({
                'template_id': template.id,
                'recipient_ids': recipients.ids,
                'employee_id': employee.id,
            })
        if self.env.context.get('active_model') == 'res.users':
            user = self.env['res.users'].browse(self.env.context['active_id'])
            employee = user.employee_id
            manager = employee.parent_id
            template = self.env.ref('hr_appraisal.mail_template_appraisal_request_from_employee', raise_if_not_found=False)
            result.update({
                'template_id': template and template.id or False,
                'recipient_ids': self._get_recipients(manager).ids,
                'employee_id': employee.id,
            })
        return result

    @api.model
    def _get_recipients(self, employees):
        partners = self.env['res.partner']
        employees_with_user = employees.filtered('user_id')

        for employee in employees_with_user:
            partners |= employee.user_id.partner_id

        for employee in employees - employees_with_user:
            if employee.work_email:
                name_email = tools.formataddr((employee.name, employee.work_email))
                partners |= self.env['res.partner'].sudo().find_or_create(name_email)
        return partners

    subject = fields.Char('Subject')
    body = fields.Html('Contents', sanitize_style=True, compute='_compute_body', store=True, readonly=False)
    attachment_ids = fields.Many2many(
        'ir.attachment', 'hr_appraisal_mail_compose_message_ir_attachments_rel',
        'wizard_id', 'attachment_id', string='Attachments')
    template_id = fields.Many2one(
        'mail.template', 'Use template', index=True,
        domain="[('model', '=', 'hr.appraisal')]")
    email_from = fields.Char(
        'From', required=True,
        default=lambda self: self.env.user.email_formatted,
        help="Email address of the sender",
    )
    author_id = fields.Many2one(
        'res.partner', 'Author', required=True,
        default=lambda self: self.env.user.partner_id.id,
        help="Author of the message.",
    )
    employee_id = fields.Many2one('hr.employee', 'Appraisal Employee')
    recipient_ids = fields.Many2many('res.partner', string='Recipients', required=True)
    deadline = fields.Date(string="Desired Deadline", required=True)

    @api.depends('template_id', 'recipient_ids')
    def _compute_body(self):
        for wizard in self:
            if wizard.template_id:
                ctx = {
                    'partner_to_name': ', '.join(wizard.recipient_ids.sorted('name').mapped('name')),
                    'recipient_users': wizard.recipient_ids.mapped('user_ids'),
                    'author_name': wizard.author_id.name,
                    'url': "${ctx['url']}",
                }
                wizard.subject = self.env['mail.render.mixin'].with_context(ctx)._render_template(wizard.template_id.subject, 'res.users', self.env.user.ids, post_process=True)[self.env.user.id]
                wizard.body = self.env['mail.render.mixin'].with_context(ctx)._render_template(wizard.template_id.body_html, 'res.users', self.env.user.ids, post_process=False)[self.env.user.id]
            elif not wizard.body:
                wizard.body = ''

    def action_invite(self):
        """ Process the wizard content and proceed with sending the related
            email(s), rendering any template patterns on the fly if needed """
        self.ensure_one()
        appraisal = self.env['hr.appraisal'].create({
            'employee_id': self.employee_id.id,
            'date_close': self.deadline,
        })
        appraisal.message_subscribe(partner_ids=self.recipient_ids.ids)
        appraisal.sudo()._onchange_employee_id()

        ctx = {'url': '/mail/view?model=%s&res_id=%s' % ('hr.appraisal', appraisal.id)}
        body = self.env['mail.render.mixin'].with_context(ctx)._render_template(self.body, 'hr.appraisal', appraisal.ids, post_process=True)[appraisal.id]

        for user in self.recipient_ids.user_ids or self.env.user:
            appraisal.with_context(mail_activity_quick_update=True).activity_schedule(
                'mail.mail_activity_data_todo', fields.Date.today(),
                summary=_('Appraisal to Confirm and Send'),
                note=_('Confirm and send appraisal of %s', appraisal.employee_id.name),
                user_id=user.id)

        appraisal.message_notify(
            subject=self.subject,
            body=body,
            email_layout_xmlid='mail.mail_notification_light',
            partner_ids=self.recipient_ids.ids)

        return {
            'view_mode': 'form',
            'res_model': 'hr.appraisal',
            'type': 'ir.actions.act_window',
            'target': 'current',
            'res_id': appraisal.id,
        }

