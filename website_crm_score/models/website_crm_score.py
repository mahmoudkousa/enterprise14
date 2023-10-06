# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
import logging

from odoo import fields, models, api
from odoo.tools import safe_eval
from odoo.osv.expression import expression


_logger = logging.getLogger(__name__)

evaluation_context = {
    'datetime': safe_eval.datetime,
    'context_today': datetime.datetime.now,
}


class website_crm_score(models.Model):
    _name = 'website.crm.score'
    _inherit = ['mail.thread']
    _description = 'Website CRM Score'

    name = fields.Char('Name', required=True)
    rule_type = fields.Selection([('score', 'Scoring'), ('active', 'Archive'), ('unlink', 'Delete')], default='score', required=True, tracking=True,
                                 help='Scoring will add a score of `value` for this lead.\n'
                                 'Archive will set active = False on the lead (archived)\n'
                                 'Delete will delete definitively the lead\n\n'
                                 'Actions are done in sql and bypass the access rights and orm mechanism (create `score`, write `active`, unlink `crm_lead`)')
    value = fields.Float('Value', default=0, required=True, tracking=True)
    domain = fields.Char('Domain', tracking=True, required=True)
    event_based = fields.Boolean(
        'Event-based rule',
        help='When checked, the rule will be re-evaluated every time, even for leads '
             'that have already been checked previously. This option incurs a large '
             'performance penalty, so it should be checked only for rules that depend '
             'on dynamic events',
        default=False, tracking=True
    )
    active = fields.Boolean(default=True, tracking=True)
    lead_all_count = fields.Integer('# Leads', compute='_compute_lead_all_count')
    last_run = fields.Datetime('Last run', help='Date from the last scoring on all leads.')

    def _compute_lead_all_count(self):
        for rec in self:
            if rec.id:
                self._cr.execute("""
                     SELECT COUNT(1)
                     FROM crm_lead_score_rel
                     WHERE score_id = %s
                     """, (rec.id,))
                rec.lead_all_count = rec._cr.fetchone()[0]
            else:
                rec.lead_all_count = 0

    @api.constrains('domain')
    def _assert_valid_domain(self):
        for rec in self:
            try:
                domain = safe_eval.safe_eval(rec.domain or '[]', evaluation_context)
                self.env['crm.lead'].search(domain, limit=1)
            except Exception as e:
                _logger.warning('Exception: %s' % (e,))
                raise Warning('The domain is incorrectly formatted')

    @api.model
    def assign_scores_to_leads(self, ids=False, lead_ids=False):
        _logger.info('Start scoring for %s rules and %s leads' % (ids and len(ids) or 'all', lead_ids and len(lead_ids) or 'all'))

        if ids:
            domain = [('id', 'in', ids)]
        elif self.ids:
            domain = [('id', 'in', self.ids)]
        else:
            domain = []
        scores = self.search(domain)

        # Sort rule to unlink before scoring
        priorities = dict(unlink=1, active=2, score=3)
        scores = sorted(scores, key=lambda k: priorities.get(k['rule_type']))

        for score in scores:
            now = datetime.datetime.now()
            domain = safe_eval.safe_eval(score.domain, evaluation_context)

            # Don't replace the domain with a 'not in' like below... that doesn't make the same thing !!!
            # domain.extend(['|', ('stage_id.is_won', '=', False), ('probability', 'not in', [0,100])])
            domain.extend(['|', ('stage_id.is_won', '=', False), '&', ('probability', '!=', 0), ('probability', '!=', 100)])

            query = self.env['crm.lead']._where_calc(domain, active_test=False)
            from_clause, where_clause, where_params = query.get_sql()

            where_clause += """ AND (crm_lead.id NOT IN (SELECT lead_id FROM crm_lead_score_rel WHERE score_id = %s)) """
            where_params.append(score.id)

            if not score.event_based and not lead_ids:
                if score.last_run:
                    # Only check leads that are newer than the last matching lead.
                    where_clause += """ AND (crm_lead.create_date > %s) """
                    where_params.append(score.last_run)

            if lead_ids:
                where_clause += """ AND (id in %s) """
                where_params.append(tuple(lead_ids))

            if score.rule_type == 'score':
                query_str = """
                    INSERT INTO crm_lead_score_rel
                    SELECT crm_lead.id AS lead_id, %s AS score_id FROM {} WHERE {}
                    RETURNING lead_id
                """.format(from_clause, where_clause)
                self._cr.execute(query_str, [score.id] + where_params)
                # Force recompute of fields that depends on score_ids
                returning_ids = [resp[0] for resp in self._cr.fetchall()]
                leads = self.env["crm.lead"].browse(returning_ids)
                leads.modified(['score_ids'])
                leads.recompute()

            elif score.rule_type == 'unlink':
                self.env['crm.lead'].flush()
                query_str = """
                    DELETE FROM crm_lead
                    WHERE id IN (SELECT crm_lead.id FROM {} WHERE {})
                """.format(from_clause, where_clause)
                self._cr.execute(query_str, where_params)

            elif score.rule_type == 'active':
                query_str = """
                    UPDATE crm_lead
                    SET active = 'f'
                    WHERE id IN (SELECT crm_lead.id FROM {} WHERE {})
                """.format(from_clause, where_clause)
                self._cr.execute(query_str, where_params)

            if not (lead_ids or ids):  # if global scoring
                score.last_run = now

        _logger.info('End scoring')
