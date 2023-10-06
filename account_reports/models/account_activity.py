# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.tools import date_utils
from odoo.tools.misc import format_date
from dateutil.relativedelta import relativedelta
from odoo.exceptions import UserError
import json
import base64

class AccountMove(models.Model):
    _inherit = "account.move"

    tax_closing_end_date = fields.Date(help="Technical field used for VAT closing, containig the end date of the period this entry closes.")
    tax_report_control_error = fields.Boolean(help="technical field used to know if there was a failed control check")

    def action_open_tax_report(self):
        action = self.env["ir.actions.actions"]._for_xml_id("account_reports.action_account_report_gt")
        options = self._compute_vat_period_date()
        # Pass options in context and set ignore_session: read to prevent reading previous options
        action.update({'params': {'options': options, 'ignore_session': 'read'}})
        return action

    def refresh_tax_entry(self):
        for move in self.filtered(lambda m: m.tax_closing_end_date and m.state == 'draft'):
            options = move._compute_vat_period_date()
            ctx = move.env['account.report']._set_context(options)
            ctx['strict_range'] = True
            move.env['account.generic.tax.report'].with_context(ctx)._generate_tax_closing_entry(options, move=move, raise_on_empty=True)

    def _compute_vat_period_date(self):
        self.ensure_one()
        date_to = self.tax_closing_end_date
        # Take the periodicity of tax report from the company and compute the starting period date.
        delay = self.company_id.account_tax_next_activity_type.delay_count - 1
        date_from = date_utils.start_of(date_to + relativedelta(months=-delay), 'month')
        report = self.env['account.generic.tax.report']
        options = {'date': {
            'date_from': date_from,
            'date_to': date_to,
            'filter': 'custom',
            'mode': report.filter_date.get('mode', 'range')
        }}
        return report._get_options(options)

    def _close_tax_entry(self):
        # Close the activity if any and create a new move and a new activity
        # also freeze lock date
        # and fetch pdf
        for move in self:
            # Change lock date to end date of the period
            if not self.user_has_groups('account.group_account_manager'):
                raise UserError(_('Only Billing Administrators are allowed to change lock dates!'))
            move.company_id.sudo().tax_lock_date = move.tax_closing_end_date

            # Add pdf report as attachment to move
            options = move._compute_vat_period_date()
            ctx = self.env['account.report']._set_context(options)
            ctx['strict_range'] = True
            attachments = self.env['account.generic.tax.report'].with_context(ctx)._get_vat_report_attachments(options)
            # end activity
            tax_activity_type = move.company_id.account_tax_next_activity_type or False
            activity = move.activity_ids.filtered(lambda m: m.activity_type_id == tax_activity_type)
            if len(activity):
                activity.action_done()
            # post the message with the PDF
            subject = _('Vat closing from %s to %s') % (format_date(self.env, options.get('date').get('date_from')), format_date(self.env, options.get('date').get('date_to')))
            move.with_context(no_new_invoice=True).message_post(body=move.ref, subject=subject, attachments=attachments)
            # create the recurring entry (new draft move and new activity)
            move.company_id._create_edit_tax_reminder(move.tax_closing_end_date + relativedelta(days=1))

    def _post(self, soft=True):
        # When posting entry, generate the pdf and next activity for the tax moves.
        tax_return_moves = self.filtered(lambda m: m.tax_closing_end_date)
        tax_return_moves._close_tax_entry()
        return super()._post(soft)


class AccountTaxReportActivityType(models.Model):
    _inherit = "mail.activity.type"

    category = fields.Selection(selection_add=[('tax_report', 'Tax report')])

class AccountTaxReportActivity(models.Model):
    _inherit = "mail.activity"

    def action_open_tax_report(self):
        self.ensure_one()
        move = self.env['account.move'].browse(self.res_id)
        return move.action_open_tax_report()
