# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    next_appraisal_date = fields.Date(
        string='Next Appraisal Date', groups="hr.group_hr_user",
        help="The date of the next appraisal is computed by the appraisal plan's dates (first appraisal + periodicity).")
    last_appraisal_date = fields.Date(
        string='Last Appraisal Date', groups="hr.group_hr_user",
        help="The date of the last appraisal",
        default=fields.Date.today)
    related_partner_id = fields.Many2one('res.partner', compute='_compute_related_partner', groups="hr.group_hr_user")

    def _compute_related_partner(self):
        for rec in self:
            rec.related_partner_id = rec.user_id.partner_id

    def _get_appraisals_to_create_employees(self, months, plan):
        company_id = plan.company_id.id
        current_date = datetime.date.today()
        days = int(self.env['ir.config_parameter'].sudo().get_param('hr_appraisal.appraisal_create_in_advance_days', 8))
        if plan.event == 'last_appraisal':
            return self.search([
                ('last_appraisal_date', '<=', current_date - relativedelta(months=months, days=-days)),
                ('next_appraisal_date', '=', False),
                ('company_id', '=', company_id),
            ])
        return self.search([
            ('create_date', '>', current_date - relativedelta(months=months + 1, days=-days)),
            ('create_date', '<=', current_date - relativedelta(months=months, days=-days)),
            ('next_appraisal_date', '=', False),
            ('company_id', '=', company_id),
        ])
