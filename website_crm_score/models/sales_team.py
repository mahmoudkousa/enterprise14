# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, api, models, tools
from odoo.tools import safe_eval

from random import randint, shuffle

import datetime
import logging
import math
import threading

_logger = logging.getLogger(__name__)

evaluation_context = {
    'datetime': safe_eval.datetime,
    'context_today': datetime.datetime.now,
}


class crm_team(models.Model):
    _name = 'crm.team'
    _inherit = ['crm.team', 'mail.thread']

    @api.model
    def _get_default_team_id(self, user_id=None, domain=None):
        if user_id is None:
            user_id = self.env.user.id
        team_id = self.sudo().search([
            ('team_user_ids.user_id', '=', user_id),
            '|', ('company_id', '=', False), ('company_id', '=', self.env.company.id)
        ], limit=1)
        if not team_id:
            team_id = super(crm_team, self)._get_default_team_id(user_id=user_id, domain=domain)
        return team_id

    score_team_domain = fields.Char('Domain', tracking=True)
    lead_capacity = fields.Integer(compute='_compute_lead_capacity')
    team_user_ids = fields.One2many('team.user', 'team_id', string='Salesman')
    min_for_assign = fields.Integer("Minimum score", help="Minimum score to be automatically assign (>=)", default=0, required=True, tracking=True)

    def _compute_lead_capacity(self):
        for rec in self:
            rec.lead_capacity = sum(s.maximum_user_leads for s in rec.team_user_ids)

    @api.constrains('score_team_domain')
    def _assert_valid_domain(self):
        for rec in self:
            try:
                domain = safe_eval.safe_eval(rec.score_team_domain or '[]', evaluation_context)
                self.env['crm.lead'].search(domain, limit=1)
            except Exception:
                raise Warning('The domain is incorrectly formatted')

    @api.model
    def direct_assign_leads(self, ids=[]):
        self._assign_leads()

    @api.model
    def assign_leads_to_salesteams(self, all_salesteams):
        BUNDLE_LEADS = int(self.env['ir.config_parameter'].sudo().get_param('website_crm_score.bundle_size', default=50))
        shuffle(all_salesteams)
        haslead = True
        salesteams_done = []
        while haslead:
            haslead = False
            for salesteam in all_salesteams:
                if salesteam['id'] in salesteams_done:
                    continue
                domain = safe_eval.safe_eval(salesteam['score_team_domain'], evaluation_context)
                limit_date = fields.Datetime.to_string(datetime.datetime.now() - datetime.timedelta(hours=1))
                domain.extend([('create_date', '<', limit_date), ('team_id', '=', False), ('user_id', '=', False)])
                domain.extend(['|', ('stage_id.is_won', '=', False), '&', ('probability', '!=', 0), ('probability', '!=', 100)])
                leads = self.env["crm.lead"].search(domain, limit=BUNDLE_LEADS)
                haslead = haslead or (len(leads) == BUNDLE_LEADS)
                _logger.info('Assignation of %s leads for team %s' % (len(leads), salesteam['id']))
                _logger.debug('List of leads: %s' % leads)

                if len(leads) < BUNDLE_LEADS:
                    salesteams_done.append(salesteam['id'])

                leads.write({'team_id': salesteam['id']})

                # Erase fake/false email
                spams = [
                    x.id for x in leads
                    if x.email_from and not tools.email_normalize(x.email_from)
                ]

                if spams:
                    self.env["crm.lead"].browse(spams).write({'email_from': False})

                # Merge duplicated lead
                leads_done = set()
                leads_merged = set()

                for lead in leads:
                    if lead.id not in leads_done:
                        leads_duplicated = lead._get_lead_duplicates(email=lead.email_from)
                        if len(leads_duplicated) > 1:
                            merged = leads_duplicated.with_context(assign_leads_to_salesteams=True).merge_opportunity(False, False)
                            _logger.debug('Lead [%s] merged of [%s]' % (merged, leads_duplicated))
                            leads_merged.add(merged.id)
                        leads_done.update(leads_duplicated.ids)
                    # auto-commit except in testing mode
                    auto_commit = not getattr(threading.currentThread(), 'testing', False)
                    if auto_commit:
                        self._cr.commit()
                if leads_merged:
                    self.env['website.crm.score'].assign_scores_to_leads(lead_ids=list(leads_merged))
                # auto-commit except in testing mode
                auto_commit = not getattr(threading.currentThread(), 'testing', False)
                if auto_commit:
                    self._cr.commit()

    @api.model
    def assign_leads_to_salesmen(self, all_team_users):
        users = []
        for su in all_team_users:
            if (su.maximum_user_leads - su.lead_month_count) <= 0:
                continue
            domain = safe_eval.safe_eval(su.team_user_domain or '[]', evaluation_context)
            domain.extend([
                ('user_id', '=', False),
                ('date_open', '=', False),
                ('score', '>=', su.team_id.min_for_assign)
            ])

            # assignation rythm: 2 days of leads if a lot of leads should be assigned
            limit = int(math.ceil(su.maximum_user_leads / 15.0))

            domain.append(('team_id', '=', su.team_id.id))

            leads = self.env["crm.lead"].search(domain, order='score desc', limit=limit * len(su.team_id.team_user_ids))
            users.append({
                "su": su,
                "nbr": min(su.maximum_user_leads - su.lead_month_count, limit),
                "leads": leads
            })

        assigned = set()
        while users:
            i = 0

            # statistically select the user that should receive the next lead
            idx = randint(0, sum(u['nbr'] for u in users) - 1)

            while idx > users[i]['nbr']:
                idx -= users[i]['nbr']
                i += 1
            user = users[i]

            # Get the first unassigned leads available for this user
            while user['leads'] and user['leads'][0] in assigned:
                user['leads'] = user['leads'][1:]
            if not user['leads']:
                del users[i]
                continue

            # lead convert for this user
            lead = user['leads'][0]
            assigned.add(lead)

            # Assign date will be setted by write function
            data = {'user_id': user['su'].user_id.id}

            # ToDo in master/saas-14: add option mail_auto_subscribe_no_notify on the saleman/saleteam
            lead.with_context(mail_auto_subscribe_no_notify=True).write(data)
            lead.convert_opportunity(lead.partner_id and lead.partner_id.id or None)
            # auto-commit except in testing mode
            auto_commit = not getattr(threading.currentThread(), 'testing', False)
            if auto_commit:
                self._cr.commit()

            user['nbr'] -= 1
            if not user['nbr']:
                del users[i]

    @api.model
    def _assign_leads(self):
        _logger.info('### START leads assignation')

        all_salesteams = self.search_read(fields=['score_team_domain'], domain=[('score_team_domain', '!=', False)])

        all_team_users = self.env['team.user'].search([])

        _logger.info('Starting assign_scores_to_leads')

        self.env['website.crm.score'].assign_scores_to_leads()

        _logger.info('Start assign_leads_to_salesteams for %s teams' % len(all_salesteams))

        self.assign_leads_to_salesteams(all_salesteams)

        # Compute score after assign to salesteam, because if a merge has been done, the score for leads is removed.
        _logger.info('Start re-assign_scores_to_leads')
        self.env['website.crm.score'].assign_scores_to_leads()

        _logger.info('Start assign_leads_to_salesmen for %s salesmen' % len(all_team_users))

        self.assign_leads_to_salesmen(all_team_users)

        _logger.info('### END leads assignation')
