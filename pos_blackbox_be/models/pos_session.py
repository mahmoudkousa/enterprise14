# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from odoo.exceptions import UserError
from odoo.tools.translate import _


class pos_session(models.Model):
    _inherit = 'pos.session'

    pro_forma_order_ids = fields.One2many('pos.order_pro_forma_be', 'session_id')

    total_sold = fields.Monetary(compute='_compute_total_sold')
    total_pro_forma = fields.Monetary(compute='_compute_total_pro_forma')
    total_base_of_measure_tax_a = fields.Monetary(compute='_compute_total_tax')
    total_base_of_measure_tax_b = fields.Monetary(compute='_compute_total_tax')
    total_base_of_measure_tax_c = fields.Monetary(compute='_compute_total_tax')
    total_base_of_measure_tax_d = fields.Monetary(compute='_compute_total_tax')
    total_tax_a = fields.Monetary(compute='_compute_total_tax')
    total_tax_b = fields.Monetary(compute='_compute_total_tax')
    total_tax_c = fields.Monetary(compute='_compute_total_tax')
    total_tax_d = fields.Monetary(compute='_compute_total_tax')
    cash_box_opening_number = fields.Integer(help='Count the number of cashbox opening during the session')
    users_clocked_ids = fields.Many2many(
        'res.users',
        'users_session_clocking_info',
        string='Users Clocked In',
        help='This is a technical field used for tracking the status of the session for each users.',
    )
    employees_clocked_ids = fields.Many2many(
        'hr.employee',
        'employees_session_clocking_info',
        string='Employees Clocked In',
        help='This is a technical field used for tracking the status of the session for each employees.',
    )

    @api.depends('order_ids')
    def _compute_total_tax(self):
        for rec in self:
            rec.total_base_of_measure_tax_a = 0
            rec.total_base_of_measure_tax_b = 0
            rec.total_base_of_measure_tax_c = 0
            rec.total_base_of_measure_tax_d = 0
            for order in rec.order_ids:
                rec.total_base_of_measure_tax_a += order.blackbox_tax_category_a
                rec.total_base_of_measure_tax_b += order.blackbox_tax_category_b
                rec.total_base_of_measure_tax_c += order.blackbox_tax_category_c
                rec.total_base_of_measure_tax_d += order.blackbox_tax_category_d
            # compute the tax totals
            currency = self.env['res.currency'].browse(rec.currency_id.id)
            rec.total_tax_a = currency.round(rec.total_base_of_measure_tax_a * 0.21)
            rec.total_tax_b = currency.round(rec.total_base_of_measure_tax_b * 0.12)
            rec.total_tax_c = currency.round(rec.total_base_of_measure_tax_c * 0.06)
            rec.total_tax_d = 0

    def get_user_session_work_status(self, user_id):
        if self.config_id.module_pos_hr and user_id in self.employees_clocked_ids.ids:
            return True
        elif not self.config_id.module_pos_hr and user_id in self.users_clocked_ids.ids:
            return True
        return False

    def increase_cash_box_opening_counter(self):
        self.cash_box_opening_number += 1

    def set_user_session_work_status(self, user_id, status):
        context = 'employees_clocked_ids' if self.config_id.module_pos_hr else 'users_clocked_ids'
        if status:
            self.write({context: [(4, user_id)]})
        else:
            self.write({context: [(3, user_id)]})
        return self[context].ids

    def action_pos_session_closing_control(self):
        # The government does not want PS orders that have not been
        # finalized into an NS before we close a session
        pro_forma_orders = self.env['pos.order_pro_forma_be'].search([('session_id', '=', self.id)])
        regular_orders = self.env['pos.order'].search([('session_id', '=', self.id)])

        # we can link pro forma orders to regular orders using their pos_reference
        pro_forma_orders = {order.pos_reference for order in pro_forma_orders}
        regular_orders = {order.pos_reference for order in regular_orders}
        non_finalized_orders = pro_forma_orders.difference(regular_orders)

        if non_finalized_orders:
            raise UserError(_("Your session still contains open orders (%s). Please close all of them first.") % ', '.join(non_finalized_orders))

        return super(pos_session, self).action_pos_session_closing_control()

    def get_user_report_data(self):
        ir_model_data = self.env['ir.model.data']
        work_in = ir_model_data.xmlid_to_object('pos_blackbox_be.product_product_work_in').product_tmpl_id.id
        work_out = ir_model_data.xmlid_to_object('pos_blackbox_be.product_product_work_out').product_tmpl_id.id
        data = {}
        i = 0
        if self.config_id.iface_fiscal_data_module:
            for order in sorted(self.order_ids, key=lambda o: o.date_order):
                for line in order.lines:
                    if line.product_id.product_tmpl_id.id == work_in:
                        data[i] = {
                            'login': order.user_id.name if not self.config_id.module_pos_hr else order.employee_id.name,
                            'insz_or_bis_number': order.user_id.insz_or_bis_number if not self.config_id.module_pos_hr else order.employee_id.insz_or_bis_number,
                            'revenue': 0,
                            'revenue_per_category': {},
                            'first_ticket_time': order.blackbox_pos_receipt_time,
                            'last_ticket_time': False,
                            'fdmIdentifier': order.config_id.certifiedBlackboxIdentifier
                        }
                    elif line.product_id.product_tmpl_id.id == work_out:
                        data[i]['last_ticket_time'] = order.blackbox_pos_receipt_time
                        i += 1
                    else:
                        data[i]['revenue'] += line.price_subtotal_incl
                        total_sold_per_category = {}
                        for l in order.lines:
                            key = l.product_id.pos_categ_id.name or "None"
                            if key in total_sold_per_category:
                                total_sold_per_category[key] += l.price_subtotal_incl
                            else:
                                total_sold_per_category[key] = l.price_subtotal_incl
                        data[i]['revenue_per_category'] = list(total_sold_per_category.items())
        return data

    def action_report_journal_file(self):
        self.ensure_one()
        pos = self.config_id
        if not pos.iface_fiscal_data_module:
            raise UserError(_("PoS %s is not a certified PoS", pos.name))
        return {
            'type': 'ir.actions.act_url',
            'url': "/journal_file/" + str(pos.certifiedBlackboxIdentifier),
            'target': 'self',
        }

    def get_total_discount(self):
        amount = 0
        for line in self.env['pos.order.line'].search([('order_id', 'in', self.order_ids.ids), ('discount', '>', 0)]):
            normal_price = line.qty * line.price_unit
            normal_price = normal_price + (normal_price / 100 * line.tax_ids.amount)
            amount += normal_price - line.price_subtotal_incl

        return amount

    def get_total_correction(self):
        total_corrections = 0
        for order in self.order_ids:
            for line in order.lines:
                if line.price_subtotal_incl < 0:
                    total_corrections += line.price_subtotal_incl

        return total_corrections

    def get_total_proforma(self):
        amount_total = 0
        for pf in self.pro_forma_order_ids:
            amount_total += pf.amount_total

        return amount_total

    def get_invoice_total_list(self):
        invoice_list = []
        for order in self.order_ids.filtered(lambda o: o.is_invoiced):
            invoice = {
                'total': order.account_move.amount_total,
                'name': order.account_move.highest_name
            }
            invoice_list.append(invoice)

        return invoice_list

    def get_total_invoice(self):
        amount = 0
        for order in self.order_ids.filtered(lambda o: o.is_invoiced):
            amount += order.amount_paid

        return amount
