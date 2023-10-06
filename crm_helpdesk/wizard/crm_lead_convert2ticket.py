# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class CrmLeadConvert2Ticket(models.TransientModel):
    """ wizard to convert a Lead into a Helpdesk ticket and move the Mail Thread """
    _name = "crm.lead.convert2ticket"
    _description = 'Lead convert to Ticket'

    @api.model
    def default_get(self, fields):
        result = super(CrmLeadConvert2Ticket, self).default_get(fields)
        if 'partner_id' in fields:
            lead_id = result.get('lead_id')
            if lead_id:
                lead = self.env['crm.lead'].browse(lead_id)
                result['partner_id'] = lead._find_matching_partner().id
        return result

    lead_id = fields.Many2one(
        'crm.lead', string='Lead', domain=[('type', '=', 'lead')],
        default=lambda self: self.env.context.get('active_id', None),
    )
    partner_id = fields.Many2one('res.partner', 'Customer')
    team_id = fields.Many2one('helpdesk.team', string='Team', required=True)
    ticket_type_id = fields.Many2one('helpdesk.ticket.type', "Ticket Type")

    def action_lead_to_helpdesk_ticket(self):
        self.ensure_one()
        # get the lead to transform
        lead = self.lead_id
        partner_id = self.partner_id.id
        if not partner_id and (lead.partner_name or lead.contact_name):
            lead.handle_partner_assignment(create_missing=True)
            partner_id = lead.partner_id.id
        # create new helpdesk.ticket
        vals = {
            "name": lead.name,
            "description": lead.description,
            "team_id": self.team_id.id,
            "ticket_type_id": self.ticket_type_id.id,
            "partner_id": partner_id,
            "user_id": None
        }
        if lead.email_from:
            vals['email'] = lead.email_from
        ticket_sudo = self.env['helpdesk.ticket'].with_context(mail_create_nosubscribe=True).sudo().create(vals)
        # move the mail thread
        lead.message_change_thread(ticket_sudo)
        # move attachments
        attachments = self.env['ir.attachment'].search([('res_model', '=', 'crm.lead'), ('res_id', '=', lead.id)])
        attachments.sudo().write({'res_model': 'helpdesk.ticket', 'res_id': ticket_sudo.id})
        # archive the lead
        lead.action_archive()

        # return to ticket (if can see) or lead (if cannot)
        try:
            self.env['helpdesk.ticket'].check_access_rights('read')
            self.env['helpdesk.ticket'].browse(ticket_sudo.ids).check_access_rule('read')
        except:
            return {
                'name': _('Lead Converted'),
                'view_mode': 'form',
                'res_model': lead._name,
                'type': 'ir.actions.act_window',
                'res_id': lead.id
            }

        # return the action to go to the form view of the new Ticket
        view = self.env.ref('helpdesk.helpdesk_ticket_view_form')
        return {
            'name': _('Ticket created'),
            'view_mode': 'form',
            'view_id': view.id,
            'res_model': 'helpdesk.ticket',
            'type': 'ir.actions.act_window',
            'res_id': ticket_sudo.id,
            'context': self.env.context
        }
