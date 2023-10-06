# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.tools import date_utils
from odoo.tools.misc import format_date


class ResCompany(models.Model):
    _inherit = "res.company"

    totals_below_sections = fields.Boolean(
        string='Add totals below sections',
        help='When ticked, totals and subtotals appear below the sections of the report.')
    account_tax_periodicity = fields.Selection([
        ('year', 'annually'),
        ('semester', 'semi-annually'),
        ('4_months', 'every 4 months'),
        ('trimester', 'quarterly'),
        ('2_months', 'every 2 months'),
        ('monthly', 'monthly')], string="Delay units", help="Periodicity", default='monthly')
    account_tax_periodicity_reminder_day = fields.Integer(string='Start from', default=7)
    account_tax_original_periodicity_reminder_day = fields.Integer(string='Start from original', help='technical helper to prevent rewriting activity date when saving settings')
    account_tax_periodicity_journal_id = fields.Many2one('account.journal', string='Journal', domain=[('type', '=', 'general')])
    account_tax_next_activity_type = fields.Many2one('mail.activity.type')
    account_revaluation_journal_id = fields.Many2one('account.journal', domain=[('type', '=', 'general')])
    account_revaluation_expense_provision_account_id = fields.Many2one('account.account', string='Expense Provision Account')
    account_revaluation_income_provision_account_id = fields.Many2one('account.account', string='Income Provision Account')

    def _get_default_misc_journal(self):
        """ Returns a default 'miscellanous' journal to use for
        account_tax_periodicity_journal_id field. This is useful in case a
        CoA was already installed on the company at the time the module
        is installed, so that the field is set automatically when added."""
        return self.env['account.journal'].search([('type', '=', 'general'), ('show_on_dashboard', '=', True), ('company_id', '=', self.id)], limit=1)

    def get_default_selected_tax_report(self):
        """ Returns the tax report object to be selected by default the first
        time the tax report is open for current company; or None if there isn't any.

        This method just selects the first available one, but is intended to be
        a hook for localization modules wanting to select a specific report
        depending on some particular factors (type of business, installed CoA, ...)
        """
        self.ensure_one()
        available_reports = self.get_available_tax_reports()
        return available_reports and available_reports[0] or None

    def get_available_tax_reports(self):
        """ Returns all the tax reports available for the country of the current
        company.
        """
        self.ensure_one()
        return self.env['account.tax.report'].search([('country_id', '=', self.account_tax_fiscal_country_id.id)])

    def write(self, values):
        # in case the user want to change the journal or the periodicity without changing the date, we should change the next_activity
        # therefore we set the account_tax_original_periodicity_reminder_day to false so that it will be recomputed
        for company in self:
            if (values.get('account_tax_periodicity', company.account_tax_periodicity) != company.account_tax_periodicity \
            or values.get('account_tax_periodicity_journal_id', company.account_tax_periodicity_journal_id.id) != company.account_tax_periodicity_journal_id.id):
                values['account_tax_original_periodicity_reminder_day'] = False

        return super(ResCompany, self).write(values)

    def _update_account_tax_periodicity_reminder_day(self):
        self.ensure_one()
        move_id = self._create_edit_tax_reminder(fields.Date.today())
        if move_id:
            move_to_delete = self.env['account.move'].search([
                ('id', '!=', move_id.id),
                ('state', '=', 'draft'),
                ('activity_ids.activity_type_id', '=', self.account_tax_next_activity_type.id),
                ('company_id', '=', self.id)
            ])
            if len(move_to_delete):
                journal_to_reset = [a.journal_id.id for a in move_to_delete]
                move_to_delete.unlink()
                self.env['account.journal'].browse(journal_to_reset).write({'show_on_dashboard': False})

            # Finally, add the journal visible in the dashboard
            self.account_tax_periodicity_journal_id.show_on_dashboard = True

    def _create_edit_tax_reminder(self, in_period_date, create_when_empty=False):
        self.ensure_one()

        if self._context.get('no_create_move', False):
            return self.env['account.move']
        if not create_when_empty and not self.env['account.tax.group']._any_is_configured(self):
            return False

        # Create/Edit activity type if needed
        move_res_model_id = self.env['ir.model'].search([('model', '=', 'account.move')], limit=1).id
        activity_type = self.account_tax_next_activity_type or False
        delay_count = self._get_tax_periodicity_months_delay()
        vals = {
            'category': 'tax_report',
            'delay_count': delay_count,
            'delay_unit': 'months',
            'delay_from': 'previous_activity',
            'res_model_id': move_res_model_id,
            'force_next': False,
        }
        if not activity_type:
            vals.update({
                'name': _('Tax Report for company %s') % (self.name,),
                'summary': _('TAX Report'),
            })
            activity_type = self.env['mail.activity.type'].sudo().create(vals).sudo(False)
            self.account_tax_next_activity_type = activity_type
        else:
            activity_type.sudo().write(vals)

        # Compute period dates depending on the date
        period_start, period_end = self._get_tax_closing_period_boundaries(in_period_date)
        activity_deadline = period_end + relativedelta(days=self.account_tax_periodicity_reminder_day)

        # Search for an existing tax closing move
        tax_closing_move = self.env['account.move'].search([
            ('state', '=', 'draft'),
            ('journal_id', '=', self.account_tax_periodicity_journal_id.id),
            ('activity_ids.activity_type_id', '=', activity_type.id),
            ('tax_closing_end_date', '<=', period_end),
            ('tax_closing_end_date', '>=', period_start)
        ], limit=1)

        # Compute tax closing description
        ref = self._get_tax_closing_move_description(self.account_tax_periodicity, period_start, period_end)

        # Write move
        if tax_closing_move:
            # Update the next activity on the existing move
            for act in tax_closing_move.activity_ids:
                if act.activity_type_id == activity_type:
                    act.write({'date_deadline': activity_deadline})
            tax_closing_move.date = period_end
            tax_closing_move.ref = ref
            tax_closing_move.tax_closing_end_date = period_end
        else:
            # Create a new, empty, tax closing move
            tax_closing_move = self.env['account.move'].create({
                'journal_id': self.account_tax_periodicity_journal_id.id,
                'date': period_end,
                'tax_closing_end_date': period_end,
                'ref': ref,
            })
            advisor_user = self.env['res.users'].search(
                [('company_ids', 'in', (self.id,)), ('groups_id', 'in', self.env.ref('account.group_account_manager').ids)],
                limit=1, order="id ASC")
            activity_vals = {
                'res_id': tax_closing_move.id,
                'res_model_id': move_res_model_id,
                'activity_type_id': activity_type.id,
                'summary': activity_type.summary,
                'note': activity_type.default_description,
                'date_deadline': activity_deadline,
                'automated': True,
                'user_id':  advisor_user.id or self.env.user.id
            }
            self.env['mail.activity'].with_context(mail_activity_quick_update=True).create(activity_vals)

        return tax_closing_move

    def _get_tax_periodicity_months_delay(self):
        """ Returns the number of months separating two tax returns with the provided periodicity
        """
        self.ensure_one()
        periodicities = {
            'year': 12,
            'semester': 6,
            '4_months': 4,
            'trimester': 3,
            '2_months': 2,
            'monthly': 1,
        }
        return periodicities[self.account_tax_periodicity]

    def _get_tax_closing_move_description(self, periodicity, period_start, period_end):
        """ Returns a string description of the provided period dates, with the
        given tax periodicity.
        """
        if periodicity == 'year':
            return _("Tax return for %s", period_start.year)
        elif periodicity == 'trimester':
            return _("Tax return for %s", format_date(self.env, period_start, date_format='qqq'))
        elif periodicity == 'monthly':
            return _("Tax return for %s", format_date(self.env, period_start, date_format='LLLL'))
        else:
            return _("Tax return from %s to %s") % (format_date(self.env, period_start), format_date(self.env, period_end))

    def _get_tax_closing_period_boundaries(self, date):
        """ Returns the boundaries of the tax period containing the provided date
        for this company, as a tuple (start, end).
        """
        self.ensure_one()
        period_months = self._get_tax_periodicity_months_delay()
        period_number = (date.month//period_months) + (1 if date.month % period_months != 0 else 0)
        end_date = date_utils.end_of(datetime.date(date.year, period_number * period_months, 1), 'month')
        start_date = end_date + relativedelta(day=1, months=-period_months + 1)

        return start_date, end_date
