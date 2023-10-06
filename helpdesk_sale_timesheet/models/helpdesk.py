# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from ast import literal_eval

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.osv import expression
from odoo.addons.sale_timesheet_enterprise.models.sale import DEFAULT_INVOICED_TIMESHEET


class HelpdeskTeam(models.Model):
    _inherit = 'helpdesk.team'

    def _create_project(self, name, allow_billable, other):
        new_values = dict(other, allow_billable=allow_billable)
        return super(HelpdeskTeam, self)._create_project(name, allow_billable, new_values)

    def write(self, vals):
        result = super(HelpdeskTeam, self).write(vals)
        if 'use_helpdesk_sale_timesheet' in vals and vals['use_helpdesk_sale_timesheet']:
            projects = self.filtered(lambda team: team.project_id).mapped('project_id')
            projects.write({'allow_billable': True, 'timesheet_product_id': projects._default_timesheet_product_id()})
        return result

class HelpdeskTicket(models.Model):
    _inherit = 'helpdesk.ticket'

    use_helpdesk_sale_timesheet = fields.Boolean('Reinvoicing Timesheet activated on Team', related='team_id.use_helpdesk_sale_timesheet', readonly=True)
    # TODO: [XBO] remove me in master
    display_create_so_button_primary = fields.Boolean(compute="_compute_sale_order_button_visibility", compute_sudo=True)
    # TODO: [XBO] remove me in master
    display_create_so_button_secondary = fields.Boolean(compute="_compute_sale_order_button_visibility", compute_sudo=True)
    # TODO: [XBO] remove me in master (or we can change in a related field to the order_id in sale_line_id)
    sale_order_id = fields.Many2one('sale.order', compute="_compute_helpdesk_sale_order", compute_sudo=True, store=True, readonly=False)
    sale_line_id = fields.Many2one('sale.order.line', string="Sales Order Item", search="_sale_line_id_search", compute="_compute_sale_line_id", readonly=False, domain="[('company_id', '=', company_id), ('is_service', '=', True), ('order_partner_id', 'child_of', commercial_partner_id), ('is_expense', '=', False), ('state', 'in', ['sale', 'done']), ('order_id', '=?', project_sale_order_id)]")
    project_sale_order_id = fields.Many2one('sale.order', string="Project's sale order", related='project_id.sale_order_id')
    sale_line_id_source = fields.Char(compute="_compute_sale_line_id")
    remaining_hours_available = fields.Boolean(related="sale_line_id.remaining_hours_available")
    remaining_hours_so = fields.Float('Remaining Hours on SO', compute='_compute_remaining_hours_so')

    @api.depends('sale_line_id', 'timesheet_ids', 'timesheet_ids.unit_amount')
    def _compute_remaining_hours_so(self):
        # TODO This is not yet perfectly working as timesheet.so_line stick to its old value although changed
        #      in the task From View.
        timesheets = self.timesheet_ids.filtered(lambda t: t.helpdesk_ticket_id.sale_line_id in (t.so_line, t._origin.so_line) and t.so_line.remaining_hours_available)

        mapped_remaining_hours = {ticket._origin.id: ticket.sale_line_id and ticket.sale_line_id.remaining_hours or 0.0 for ticket in self}
        uom_hour = self.env.ref('uom.product_uom_hour')
        for timesheet in timesheets:
            delta = 0
            if timesheet._origin.so_line == timesheet.helpdesk_ticket_id.sale_line_id:
                delta += timesheet._origin.unit_amount
            if timesheet.so_line == timesheet.helpdesk_ticket_id.sale_line_id:
                delta -= timesheet.unit_amount
            if delta:
                mapped_remaining_hours[timesheet.helpdesk_ticket_id._origin.id] += timesheet.so_line.product_uom._compute_quantity(delta, uom_hour)

        for ticket in self:
            ticket.remaining_hours_so = mapped_remaining_hours[ticket._origin.id]

    @api.depends('project_id', 'use_helpdesk_sale_timesheet', 'partner_id.commercial_partner_id')
    def _compute_related_task_ids(self):
        # TODO: [XBO] remove me in master because the task_id will be removed, then this compute and the _related_task_ids field will be useless
        reinvoiced = self.filtered(lambda t: t.project_id and t.use_helpdesk_sale_timesheet and t.partner_id)
        for t in reinvoiced:
            t._related_task_ids = self.env['project.task'].search([
                ('project_id', '=', t.project_id.id),
                '|', ('partner_id', '=', False),
                     ('partner_id', 'child_of', t.partner_id.commercial_partner_id.id)
            ])._origin
        super(HelpdeskTicket, self - reinvoiced)._compute_related_task_ids()

    @api.depends('use_helpdesk_sale_timesheet', 'project_id.allow_billable', 'project_id.sale_order_id', 'task_id.sale_line_id', 'total_hours_spent')
    def _compute_sale_order_button_visibility(self):
        # TODO: remove me in master (the button will be removed too)
        for ticket in self:
            primary, secondary = False, False
            if ticket.use_helpdesk_sale_timesheet and ticket.project_id.allow_billable:
                if ticket.project_id and ticket.project_id.bill_type == "customer_project" and not ticket.project_id.sale_order_id:
                    if ticket.total_hours_spent > 0:
                        primary = True
                    else:
                        secondary = True
                elif ticket.project_id and ticket.project_id.bill_type == "customer_task" and ticket.task_id and not ticket.task_id.sale_line_id:
                    if ticket.total_hours_spent > 0:
                        primary = True
                    else:
                        secondary = True
            ticket.display_create_so_button_primary = primary
            ticket.display_create_so_button_secondary = secondary

    def _get_timesheet(self):
        return super()._get_timesheet()._get_not_billed()

    def _search_sol_in_timesheets(self):
        # TODO: [XBO] remove me when the sale_line_id field in ticket is stored
        self.ensure_one()
        if not self.timesheet_ids:
            return False
        sale_lines = self.timesheet_ids.mapped('so_line')
        if sale_lines and len(sale_lines) == 1 and sale_lines.exists() and sale_lines.order_partner_id.commercial_partner_id == self.commercial_partner_id:
            return sale_lines
        determined_sol_ids = [t._timesheet_determine_sale_line(t.task_id, t.employee_id, t.project_id).id for t in self.timesheet_ids]
        candidat_sols = sale_lines.filtered(lambda sol: sol.id not in determined_sol_ids)
        return len(candidat_sols) == 1 and candidat_sols  # return the sol if only one SOL is in the variable or return False

    @api.depends('commercial_partner_id', 'use_helpdesk_sale_timesheet')
    def _compute_sale_line_id(self):
        billable_tickets = self.filtered('use_helpdesk_sale_timesheet')
        (self - billable_tickets).update({
            'sale_line_id_source': 'none',
            'sale_line_id': False
        })
        for ticket in billable_tickets:
            sol = ticket._search_sol_in_timesheets()
            if sol:
                ticket.sale_line_id = sol
                ticket.sale_line_id_source = 'timesheet'
            else:
                if ticket.project_id:
                    ticket.sale_line_id = ticket.project_id.sale_line_id
                    ticket.sale_line_id_source = 'project'
            # Check sale_line_id and customer are coherent
            if ticket.sale_line_id.sudo().order_partner_id.commercial_partner_id != ticket.commercial_partner_id:
                ticket.sale_line_id = False
            if not ticket.sale_line_id:
                ticket.sale_line_id = ticket._get_last_sol_of_customer()
            if not ticket.sale_line_id_source:
                ticket.sale_line_id_source = 'none'

    def _get_last_sol_of_customer(self):
        # Get the last SOL made for the customer in the current task where we need to compute
        self.ensure_one()
        if not self.commercial_partner_id or not self.project_id.allow_billable or not self.use_helpdesk_sale_timesheet:
            return False
        domain = [('company_id', '=', self.company_id.id), ('is_service', '=', True), ('order_partner_id', 'child_of', self.commercial_partner_id.id), ('is_expense', '=', False), ('state', 'in', ['sale', 'done'])]
        if self.project_id.bill_type == 'customer_project' and self.project_sale_order_id:
            domain.append(('order_id', '=?', self.project_sale_order_id.id))
        sale_lines = self.env['sale.order.line'].sudo().search(domain)
        for line in sale_lines:
            if line.remaining_hours_available and line.remaining_hours > 0:
                return line
        return False

    def _sale_line_id_search(self, operator, value):
        if operator not in ['=', '!=', 'in']:
            raise NotImplementedError("Unsupported operation.")
        all_tickets = self.env['helpdesk.ticket'].search([])
        if (operator == '=' and not value) or (operator == '!=' and value):
            no_sale_line_ids = all_tickets.filtered(lambda t: t.sale_line_id_source == 'none')
            domain = [('id', 'in', no_sale_line_ids.ids)]
        else:
            timesheet_based_ids = all_tickets.filtered(lambda t: t.sale_line_id_source == 'timesheet')
            timesheet_based_ids_domain = ['&', ('id', 'in', timesheet_based_ids.ids),
                                          ('timesheet_ids.so_line', operator, value)] if timesheet_based_ids else []
            project_based_ids = all_tickets.filtered(lambda t: t.sale_line_id_source == 'project')
            project_based_ids_domain = ['&', ('id', 'in', project_based_ids.ids),
                                        ('project_id', operator, value)] if project_based_ids else []
            domain = expression.OR([timesheet_based_ids_domain, project_based_ids_domain])
        return domain

    def write(self, values):
        recompute_so_lines = None
        other_timesheets = None
        if 'timesheet_ids' in values and isinstance(values.get('timesheet_ids'), (tuple, list)):
            # Then, we check if the list contains tuples/lists like "(code=1, timesheet_id, vals)" and we extract timesheet_id if it is an update and 'so_line' in vals
            timesheet_ids = [command[1] for command in values.get('timesheet_ids') if isinstance(command, (list, tuple)) and command[0] == 1 and 'so_line' in command[2]]
            recompute_so_lines = self.timesheet_ids.filtered(lambda t: t.id in timesheet_ids).mapped('so_line')
            if not self.env.user.has_group('hr_timesheet.group_hr_timesheet_approver') and values.get('sale_line_id', None):
                # We need to search the timesheets of other employee to update the so_line
                other_timesheets = self.env['account.analytic.line'].sudo().search([('id', 'not in', timesheet_ids), ('helpdesk_ticket_id', '=', self.id)])

        res = super(HelpdeskTicket, self).write(values)
        if other_timesheets:
            # Then we update the so_line if needed
            compute_timesheets = defaultdict(list, [(timesheet, timesheet.so_line) for timesheet in other_timesheets])  # key = timesheet and value = so_line of the timesheet before the _compute_so_line
            other_timesheets._compute_so_line()
            for timesheet, sol in compute_timesheets.items():
                if timesheet.so_line != sol:
                    recompute_so_lines |= sol
        if recompute_so_lines:
            recompute_so_lines._compute_qty_delivered()
        return res

    def create_sale_order(self):
        # TODO: [XBO] remove me in master.
        # TODO: [XBO] Moreover remove 'ticket_timesheet_ids' context key used in the 'project.create.sale.order' wizard
        self.ensure_one()
        if self.project_id.bill_type == "customer_task":
            # open project.task create sale order wizard
            if self.partner_id:
                customer = self.partner_id.id
            else:
                customer = self.task_id.partner_id.id

            return {
                "name": _("Create Sales Order"),
                "type": 'ir.actions.act_window',
                "res_model": 'project.task.create.sale.order',
                "views": [[False, "form"]],
                "target": 'new',
                "context": {
                    'active_id': self.task_id.id,
                    'active_model': 'project.task',
                    'form_view_initial_mode': 'edit',
                    'default_partner_id': customer,
                    'default_product_id': self.env.ref('sale_timesheet.time_product').id,
                },
            }
        # open project.project create sale order wizard
        if self.partner_id:
            customer = self.partner_id.id
        else:
            customer = self.project_id.partner_id.id

        return {
            "name": _("Create Sales Order"),
            "type": 'ir.actions.act_window',
            "res_model": 'project.create.sale.order',
            "views": [[False, "form"]],
            "target": 'new',
            "context": {
                'active_id': self.project_id.id,
                'active_model': 'project.project',
                'default_partner_id': customer,
                'default_product_id': self.env.ref('sale_timesheet.time_product').id,
                'ticket_timesheet_ids': self.timesheet_ids.ids
            },
        }

    @api.depends('sale_line_id', 'project_id.sale_order_id', 'task_id.sale_order_id')
    def _compute_helpdesk_sale_order(self):
        # TODO: remove me in master (sale_order_id will be removed or changes in related field)
        for ticket in self:
            if ticket.sale_line_id:
                ticket.sale_order_id = ticket.sale_line_id.order_id
            elif ticket.project_id.sale_order_id:
                ticket.sale_order_id = ticket.project_id.sale_order_id
            elif ticket.task_id.sale_order_id:
                ticket.sale_order_id = ticket.task_id.sale_order_id
            else:
                ticket.sale_order_id = False
            if ticket.sale_order_id and not ticket.partner_id:
                ticket.partner_id = ticket.sale_order_id.partner_id

    def action_view_so(self):
        self.ensure_one()
        action_window = {
            "type": "ir.actions.act_window",
            "res_model": "sale.order",
            "name": "Sales Order",
            "views": [[False, "form"]],
            "context": {"create": False, "show_sale": True},
            "res_id": self.sale_line_id.order_id.id or self.sale_order_id.id
        }
        return action_window


class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    @api.depends('task_id.sale_line_id', 'project_id.sale_line_id', 'employee_id', 'project_id.allow_billable', 'helpdesk_ticket_id.sale_line_id')
    def _compute_so_line(self):
        for timesheet in self._get_not_billed():
            if not timesheet.project_id.allow_billable:
                timesheet.so_line = False
                continue
            sol = timesheet.helpdesk_ticket_id.sale_line_id or False
            if not timesheet.task_id and timesheet.helpdesk_ticket_id:
                if timesheet.project_id.pricing_type == 'employee_rate':
                    map_entry = timesheet.project_id.sale_line_employee_ids.filtered(lambda map_entry: map_entry.employee_id == timesheet.employee_id)
                    if map_entry:
                        sol = map_entry.sale_line_id
                timesheet.so_line = sol
            else:
                super(AccountAnalyticLine, timesheet)._compute_so_line()
                if not timesheet.so_line:  # then we give the SOL in the ticket
                    timesheet.so_line = sol

    @api.depends('timesheet_invoice_id.state')
    def _compute_partner_id(self):
        super(AccountAnalyticLine, self._get_not_billed())._compute_partner_id()

    def _get_portal_helpdesk_timesheet(self):
        param_invoiced_timesheet = self.env['ir.config_parameter'].sudo().get_param('sale.invoiced_timesheet', DEFAULT_INVOICED_TIMESHEET)
        if param_invoiced_timesheet == 'approved':
            return self.filtered(lambda line: line.validated)
        return self

    def _check_timesheet_can_be_billed(self):
        return super(AccountAnalyticLine, self)._check_timesheet_can_be_billed() or self.so_line == self.helpdesk_ticket_id.sale_line_id

    @api.constrains('helpdesk_ticket_id')
    def _check_sale_line_in_project_map(self):
        try:
            super(AccountAnalyticLine, self)._check_sale_line_in_project_map()
        except ValidationError:
            raise ValidationError(_("This timesheet line cannot be billed: there is no Sale Order Item defined on the task, nor on the project and nor on the ticket. Please define one to save your timesheet line."))

    @api.depends('so_line.product_id', 'project_id', 'task_id', 'non_allow_billable', 'task_id.bill_type', 'task_id.pricing_type', 'task_id.non_allow_billable', 'helpdesk_ticket_id')
    def _compute_timesheet_invoice_type(self):
        """ Compute the correct timesheet_invoice_type for timesheets linked to a ticket

            For the tickets which have not a linked task, the timesheets of these tickets have the timesheet_invoice_type
            set to 'non_billable_project' because in the parent method we check that the task_id in each timesheet is set.
        """
        super(AccountAnalyticLine, self)._compute_timesheet_invoice_type()
        for timesheet in self.filtered(lambda t: t.timesheet_invoice_type == 'non_billable_project' and t.helpdesk_ticket_id and t.so_line and t.so_line.product_id.type == 'service'):
            # FIXME: duplicate code with the parent method in sale_timesheet module
            if timesheet.so_line.product_id.invoice_policy == 'delivery':
                if timesheet.so_line.product_id.service_type == 'timesheet':
                    invoice_type = 'billable_time'
                else:
                    invoice_type = 'billable_fixed'
            elif timesheet.so_line.product_id.invoice_policy == 'order':
                invoice_type = 'billable_fixed'
            timesheet.timesheet_invoice_type = invoice_type

    def _timesheet_get_sale_domain(self, order_lines_ids, invoice_ids):
        domain = super(AccountAnalyticLine, self)._timesheet_get_sale_domain(order_lines_ids, invoice_ids)
        if not invoice_ids:
            return domain

        return expression.OR([domain, [
            '&',
                '&',
                    ('task_id', '=', False),
                    ('helpdesk_ticket_id', '!=', False),
                ('so_line', 'in', order_lines_ids.ids)
        ]])
