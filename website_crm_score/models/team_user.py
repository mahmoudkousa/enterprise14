# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from odoo import fields, api, models
from odoo.tools import safe_eval

evaluation_context = {
    'datetime': safe_eval.datetime,
    'context_today': datetime.datetime.now,
}


class team_user(models.Model):
    _name = 'team.user'
    _inherit = ['mail.thread']
    _description = 'Salesperson (Team Member)'

    team_id = fields.Many2one('crm.team', string='Sales Team', required=True)
    user_id = fields.Many2one('res.users', string='Saleman', required=True)
    name = fields.Char(string="Name", related='user_id.partner_id.display_name', readonly=False)
    active = fields.Boolean(string='Running', default=True)
    team_user_domain = fields.Char('Domain', tracking=True)
    maximum_user_leads = fields.Integer('Leads Per Month')
    lead_month_count = fields.Integer(
        'Assigned Leads', compute='_compute_lead_month_count',
        help='Lead assigned to this member those last 30 days')

    def _compute_lead_month_count(self):
        for rec in self:
            if rec.id:
                limit_date = datetime.datetime.now() - datetime.timedelta(days=30)
                domain = [('user_id', '=', rec.user_id.id),
                          ('team_id', '=', rec.team_id.id),
                          ('date_open', '>', fields.Datetime.to_string(limit_date))
                          ]
                rec.lead_month_count = self.env['crm.lead'].search_count(domain)
            else:
                rec.lead_month_count = 0

    @api.constrains('team_user_domain')
    def _assert_valid_domain(self):
        for rec in self:
            try:
                domain = safe_eval.safe_eval(rec.team_user_domain or '[]', evaluation_context)
                self.env['crm.lead'].search(domain, limit=1)
            except Exception:
                raise Warning('The domain is incorrectly formatted')
