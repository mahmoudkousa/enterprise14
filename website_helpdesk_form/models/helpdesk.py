# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from lxml import etree


from odoo import api, fields, models
from odoo.addons.http_routing.models.ir_http import slug


class HelpdeskTeam(models.Model):
    _inherit = ['helpdesk.team']

    feature_form_url = fields.Char('URL to Submit Issue', readonly=True, compute='_compute_form_url')
    website_form_view_id = fields.Many2one('ir.ui.view', string="Form")

    @api.model
    def create(self, vals):
        team = super(HelpdeskTeam, self).create(vals)
        if 'use_website_helpdesk_form' in vals and vals['use_website_helpdesk_form']:
            team._ensure_submit_form_view()
        return team

    def write(self, vals):
        if 'use_website_helpdesk_form' in vals and vals['use_website_helpdesk_form']:
            self._ensure_submit_form_view()
        return super(HelpdeskTeam, self).write(vals)

    def unlink(self):
        teams_with_submit_form = self.filtered(lambda t: t.website_form_view_id is not False)
        for team in teams_with_submit_form:
            team.website_form_view_id.unlink()
        return super(HelpdeskTeam, self).unlink()

    def _ensure_submit_form_view(self):
        for team in self:
            if not team.website_form_view_id:
                default_form = etree.fromstring(self.env.ref('website_helpdesk_form.ticket_submit_form').arch)
                xmlid = 'website_helpdesk_form.team_form_' + str(team.id)
                form_template = self.env['ir.ui.view'].create({
                    'type': 'qweb',
                    'arch': etree.tostring(default_form),
                    'name': xmlid,
                    'key': xmlid
                })
                self.env['ir.model.data'].create({
                    'module': 'website_helpdesk_form',
                    'name': xmlid.split('.')[1],
                    'model': 'ir.ui.view',
                    'res_id': form_template.id,
                    'noupdate': True
                })

                team.write({'website_form_view_id': form_template.id})

    @api.depends('name', 'use_website_helpdesk_form')
    def _compute_form_url(self):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        for team in self:
            team.feature_form_url = (team.use_website_helpdesk_form and team.name and team.id) and (base_url + '/helpdesk/' + slug(team)) or False
