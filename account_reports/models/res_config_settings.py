# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from calendar import monthrange

from odoo import api, fields, models, _
from dateutil.relativedelta import relativedelta
from odoo.tools.misc import format_date
from odoo.tools import date_utils


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    totals_below_sections = fields.Boolean(related='company_id.totals_below_sections', string='Add totals below sections', readonly=False,
                                           help='When ticked, totals and subtotals appear below the sections of the report.')
    account_tax_periodicity = fields.Selection(related='company_id.account_tax_periodicity', string='Periodicity', readonly=False, required=True)
    account_tax_periodicity_reminder_day = fields.Integer(related='company_id.account_tax_periodicity_reminder_day', string='Reminder', readonly=False, required=True)
    account_tax_periodicity_journal_id = fields.Many2one(related='company_id.account_tax_periodicity_journal_id', string='Journal', readonly=False)
    account_tax_fiscal_country_id = fields.Many2one(string="Fiscal Country", related="company_id.account_tax_fiscal_country_id", readonly=False)

    def set_values(self):
        super(ResConfigSettings, self).set_values()
        company = self.company_id or self.env.company
        if not self.has_chart_of_accounts or (company.account_tax_original_periodicity_reminder_day and company.account_tax_original_periodicity_reminder_day == self.account_tax_periodicity_reminder_day):
            return True
        company._update_account_tax_periodicity_reminder_day()
