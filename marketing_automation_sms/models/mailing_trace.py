# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
from odoo.fields import Datetime


class MailingTrace(models.Model):
    _inherit = 'mailing.trace'

    def set_failed(self, failure_type):
        traces = self.env['marketing.trace'].search([
            ('mailing_trace_ids', 'in', self.ids)])
        traces.write({
            'state': 'error',
            'schedule_date': Datetime.now(),
            'state_msg': _('SMS failed')
        })
        return super(MailingTrace, self).set_failed(failure_type)

    def set_clicked(self, mail_mail_ids=None, mail_message_ids=None):
        traces = super(MailingTrace, self).set_clicked(mail_mail_ids=mail_mail_ids, mail_message_ids=mail_message_ids)
        marketing_sms_traces = traces.filtered(lambda trace: trace.marketing_trace_id and trace.marketing_trace_id.activity_type == 'sms')
        for marketing_trace in marketing_sms_traces.marketing_trace_id:
            marketing_trace.process_event('sms_click')
        return traces

    def set_bounced(self, mail_mail_ids=None, mail_message_ids=None):
        traces = super(MailingTrace, self).set_bounced(mail_mail_ids=mail_mail_ids, mail_message_ids=mail_message_ids)
        marketing_sms_traces = traces.filtered(lambda trace: trace.marketing_trace_id and trace.marketing_trace_id.activity_type == 'sms')
        for marketing_trace in marketing_sms_traces.marketing_trace_id:
            marketing_trace.process_event('sms_bounce')
        return traces
