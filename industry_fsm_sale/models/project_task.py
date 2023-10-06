# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from ast import literal_eval

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.osv import expression


class Task(models.Model):
    _inherit = "project.task"

    allow_material = fields.Boolean(related='project_id.allow_material')
    allow_quotations = fields.Boolean(related='project_id.allow_quotations')
    quotation_count = fields.Integer(compute='_compute_quotation_count')
    material_line_product_count = fields.Integer(compute='_compute_material_line_totals')
    material_line_total_price = fields.Float(compute='_compute_material_line_totals')
    currency_id = fields.Many2one('res.currency', related='company_id.currency_id', readonly=True)
    display_create_invoice_primary = fields.Boolean(compute='_compute_display_create_invoice_buttons')
    display_create_invoice_secondary = fields.Boolean(compute='_compute_display_create_invoice_buttons')
    invoice_status = fields.Selection(related='sale_order_id.invoice_status')

    @api.depends('allow_material', 'material_line_product_count')
    def _compute_display_conditions_count(self):
        super(Task, self)._compute_display_conditions_count()
        for task in self:
            enabled = task.display_enabled_conditions_count
            satisfied = task.display_satisfied_conditions_count
            enabled += 1 if task.allow_material else 0
            satisfied += 1 if task.allow_material and task.material_line_product_count else 0
            task.update({
                'display_enabled_conditions_count': enabled,
                'display_satisfied_conditions_count': satisfied
            })

    def _compute_quotation_count(self):
        quotation_data = self.sudo().env['sale.order'].read_group([('task_id', 'in', self.ids)], ['task_id'], ['task_id'])
        mapped_data = dict([(q['task_id'][0], q['task_id_count']) for q in quotation_data])
        for task in self:
            task.quotation_count = mapped_data.get(task.id, 0)

    @api.depends('sale_order_id.order_line.product_uom_qty', 'sale_order_id.order_line.price_total')
    def _compute_material_line_totals(self):

        def if_fsm_material_line(sale_line_id, task):
            is_not_timesheet_line = sale_line_id.product_id != task.project_id.timesheet_product_id
            is_not_empty = sale_line_id.product_uom_qty != 0
            is_not_service_from_so = sale_line_id != task.sale_line_id
            is_task_related = sale_line_id.task_id == (task or task._origin)
            return all([is_not_timesheet_line, is_not_empty, is_not_service_from_so, is_task_related])

        for task in self:
            material_sale_lines = task.sudo().sale_order_id.order_line.filtered(lambda sol: if_fsm_material_line(sol, task))
            task.material_line_total_price = sum(material_sale_lines.mapped('price_total'))
            task.material_line_product_count = sum(material_sale_lines.mapped('product_uom_qty'))

    @api.depends(
        'is_fsm', 'fsm_done', 'allow_billable', 'timer_start',
        'task_to_invoice', 'invoice_status')
    def _compute_display_create_invoice_buttons(self):
        for task in self:
            primary, secondary = True, True
            if not task.is_fsm or not task.fsm_done or not task.allow_billable or task.timer_start or \
                    not task.sale_order_id or task.invoice_status == 'invoiced' or \
                    task.sale_order_id.state in ['cancel']:
                primary, secondary = False, False
            else:
                if task.invoice_status in ['upselling', 'to invoice']:
                    secondary = False
                else:  # Means invoice status is 'Nothing to Invoice'
                    primary = False
            task.update({
                'display_create_invoice_primary': primary,
                'display_create_invoice_secondary': secondary,
            })

    @api.depends('is_fsm', 'display_timesheet_timer', 'timer_start')
    def _compute_display_create_order(self):
        super()._compute_display_create_order()
        self.filtered(lambda t: t.is_fsm or (t.display_timesheet_timer and t.timer_start)).display_create_order = False

    def _get_last_sol_of_customer(self):
        self.ensure_one()
        # For FSM task, we don't want to search the last SOL of the customer.
        if self.is_fsm:
            return False
        return super(Task, self)._get_last_sol_of_customer()

    def action_view_invoices(self):
        invoices = self.mapped('sale_order_id.invoice_ids')
        # prevent view with onboarding banner
        list_view = self.env.ref('account.view_move_tree')
        form_view = self.env.ref('account.view_move_form')
        if len(invoices) == 1:
            return {
                'type': 'ir.actions.act_window',
                'name': _('Invoice'),
                'res_model': 'account.move',
                'view_mode': 'form',
                'views': [[form_view.id, 'form']],
                'res_id': invoices.id,
            }
        return {
            'type': 'ir.actions.act_window',
            'name': _('Invoices'),
            'res_model': 'account.move',
            'view_mode': 'list,form',
            'views': [[list_view.id, 'list'], [form_view.id, 'form']],
            'domain': [('id', 'in', invoices.ids)],
        }

    def action_fsm_create_quotation(self):
        view_form_id = self.env.ref('sale.view_order_form').id
        action = self.env["ir.actions.actions"]._for_xml_id("sale.action_quotations")
        action.update({
            'views': [(view_form_id, 'form')],
            'view_mode': 'form',
            'name': self.name,
            'context': {
                'fsm_mode': True,
                'form_view_initial_mode': 'edit',
                'default_partner_id': self.partner_id.id,
                'default_task_id': self.id,
                'default_company_id': self.company_id.id,
            },
        })
        return action

    def action_fsm_view_quotations(self):
        action = self.env["ir.actions.actions"]._for_xml_id("sale.action_quotations")
        action.update({
            'name': self.name,
            'domain': [('task_id', '=', self.id)],
            'context': {
                'fsm_mode': True,
                'default_task_id': self.id,
                'default_partner_id': self.partner_id.id},
        })
        if self.quotation_count == 1:
            action['res_id'] = self.env['sale.order'].search([('task_id', '=', self.id)]).id
            action['views'] = [(self.env.ref('sale.view_order_form').id, 'form')]
        return action

    def action_fsm_view_material(self):
        if not self.partner_id:
            raise UserError(_('A customer should be set on the task to generate a worksheet.'))

        self = self.with_company(self.company_id)

        domain = [('sale_ok', '=', True), '|', ('company_id', '=', self.company_id.id), ('company_id', '=', False)]
        if self.project_id and self.project_id.timesheet_product_id:
            domain = expression.AND([domain, [('id', '!=', self.project_id.timesheet_product_id.id)]])
        deposit_product = self.env['ir.config_parameter'].sudo().get_param('sale.default_deposit_product_id')
        if deposit_product:
            domain = expression.AND([domain, [('id', '!=', deposit_product)]])

        kanban_view = self.env.ref('industry_fsm_sale.view_product_product_kanban_material')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Choose Products'),
            'res_model': 'product.product',
            'views': [(kanban_view.id, 'kanban'), (False, 'form')],
            'domain': domain,
            'context': {
                'fsm_mode': True,
                'create': self.env['product.template'].check_access_rights('create', raise_exception=False),
                'fsm_task_id': self.id,  # avoid 'default_' context key as we are going to create SOL with this context
                'pricelist': self.partner_id.property_product_pricelist.id,
                'search_default_consumable': 1,
                'hide_qty_buttons': self.fsm_done or self.sale_order_id.state == 'done'
            },
            'help': _("""<p class="o_view_nocontent_smiling_face">
                            Create a new product
                        </p><p>
                            You must define a product for everything you sell or purchase,
                            whether it's a storable product, a consumable or a service.
                        </p>""")
        }

    def action_fsm_validate(self):
        """ If allow billable on task, timesheet product set on project and user has privileges :
            Create SO confirmed with time and material.
        """
        super().action_fsm_validate()
        billable_tasks = self.filtered(lambda task: task.allow_billable and (task.allow_timesheets or task.allow_material))
        for task in billable_tasks:
            if not task.sale_line_id and not task.sudo().timesheet_ids: # Prevent creating a SO if there are no products and no timesheets
                continue
            task._fsm_ensure_sale_order()
            if task.allow_timesheets and not task.sale_line_id:
                task._fsm_create_sale_order_line()
            if task.sudo().sale_order_id.state in ['draft', 'sent']:
                task.sudo().sale_order_id.action_confirm()
        materials_sols = self.env['sale.order.line'].sudo().search([
            ('order_id', 'in', billable_tasks.sale_order_id.sudo().filtered(lambda so: so.state == 'sale').ids),
            ('task_id', 'in', billable_tasks.ids),
            ('qty_delivered_method', '=', 'manual'),
            ('product_uom_qty', '!=', 0),
            ('id', 'not in', billable_tasks.sale_line_id.ids),
            ('product_id', 'not in', billable_tasks.project_id.timesheet_product_id.ids)
        ])
        for sol in materials_sols:
            sol.qty_delivered = sol.product_uom_qty

    def _fsm_ensure_sale_order(self):
        """ get the SO of the task. If no one, create it and return it """
        sale_order = self.sale_order_id
        if not sale_order:
            sale_order = self._fsm_create_sale_order()
        return sale_order

    def _fsm_create_sale_order(self):
        """ Create the SO from the task, with the 'service product' sales line and link all timesheet to that line it """
        if not self.partner_id:
            raise UserError(_('A customer should be set on the task to generate a worksheet.'))

        SaleOrder = self.env['sale.order']
        if self.user_has_groups('project.group_project_user'):
            SaleOrder = SaleOrder.sudo()

        domain = ['|', ('company_id', '=', False), ('company_id', '=', self.company_id.id)]
        team = self.env['crm.team'].sudo()._get_default_team_id(domain=domain)
        sale_order = SaleOrder.create({
            'partner_id': self.partner_id.id,
            'company_id': self.company_id.id,
            'task_id': self.id,
            'analytic_account_id': self.project_id.analytic_account_id.id,
            'team_id': team.id if team else False,
        })
        sale_order.onchange_partner_id()

        # write after creation since onchange_partner_id sets the current user
        sale_order.write({'user_id': self.user_id.id})
        sale_order.onchange_user_id()

        self.sale_order_id = sale_order

    def _fsm_create_sale_order_line(self):
        sale_order_line = self.env['sale.order.line'].sudo().create({
            'order_id': self.sale_order_id.id,
            'product_id': self.project_id.timesheet_product_id.id,
            'project_id': self.project_id.id,
            'task_id': self.id,
            'product_uom_qty': self.total_hours_spent,
            'product_uom': self.project_id.timesheet_product_id.uom_id.id,
        })
        # calling the onchange to handle discounts due to customer pricelists
        sale_order_line._onchange_discount()
        self.write({
            'sale_line_id': sale_order_line.id,
        })

        # assign SOL to timesheets
        self.env['account.analytic.line'].sudo().search([
            ('task_id', '=', self.id),
            ('so_line', '=', False),
            ('project_id', '!=', False)
        ]).write({
            'so_line': sale_order_line.id
        })


class ProjectTaskRecurrence(models.Model):
    _inherit = 'project.task.recurrence'

    def _get_sale_line_id(self, task):
        if not task.is_fsm:
            return super()._get_sale_line_id(task)
        return False
