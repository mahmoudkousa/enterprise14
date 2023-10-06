# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class HrContract(models.Model):
    _inherit = 'hr.contract'

    @api.model
    def _get_available_vehicles_domain(self, driver_id=None, vehicle_type='car'):
        return expression.AND([
            expression.AND([
                expression.OR([
                    [('future_driver_id', '=', False)],
                    [('future_driver_id', '=', driver_id.id if driver_id else False)],
                ]),
                [('model_id.vehicle_type', '=', vehicle_type)],
            ]),
            expression.OR([
                [('driver_id', '=', False)],
                [('driver_id', '=', driver_id.id if driver_id else False)],
                [('plan_to_change_car', '=', True)]
            ])
        ])

    def _get_possible_model_domain(self, vehicle_type='car'):
        return [('can_be_requested', '=', True), ('vehicle_type', '=', vehicle_type)]

    car_id = fields.Many2one('fleet.vehicle', string='Company Car',
        tracking=True, compute="_compute_car_id", store=True, readonly=False,
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id), ('vehicle_type', '=', 'car')]",
        help="Employee's company car.",
        groups='fleet.fleet_group_manager')
    car_atn = fields.Float(compute='_compute_car_atn_and_costs', string='Benefit in Kind (Company Car)', store=True, compute_sudo=True)
    wishlist_car_total_depreciated_cost = fields.Float(compute='_compute_car_atn_and_costs', store=True, compute_sudo=True)
    company_car_total_depreciated_cost = fields.Float(compute='_compute_car_atn_and_costs', store=True, compute_sudo=True)
    available_cars_amount = fields.Integer(compute='_compute_available_cars_amount', string='Number of available cars')
    new_car = fields.Boolean('Request a new car')
    new_car_model_id = fields.Many2one('fleet.vehicle.model', string="Model", domain=lambda self: self._get_possible_model_domain())
    max_unused_cars = fields.Integer(compute='_compute_max_unused_cars')
    acquisition_date = fields.Date(related='car_id.acquisition_date', readonly=False, groups="fleet.fleet_group_manager")
    car_value = fields.Float(related="car_id.car_value", readonly=False, groups="fleet.fleet_group_manager")
    fuel_type = fields.Selection(related="car_id.fuel_type", readonly=False, groups="fleet.fleet_group_manager")
    co2 = fields.Float(related="car_id.co2", readonly=False, groups="fleet.fleet_group_manager")
    driver_id = fields.Many2one('res.partner', related="car_id.driver_id", readonly=False, groups="fleet.fleet_group_manager")
    car_open_contracts_count = fields.Integer(compute='_compute_car_open_contracts_count', groups="fleet.fleet_group_manager")
    recurring_cost_amount_depreciated = fields.Float(
        groups="fleet.fleet_group_manager",
        compute='_compute_recurring_cost_amount_depreciated',
        inverse="_inverse_recurring_cost_amount_depreciated")
    transport_mode_bike = fields.Boolean('Uses Bike')
    bike_id = fields.Many2one('fleet.vehicle', string="Company Bike",
        tracking=True,
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id), ('vehicle_type', '=', 'bike')]",
        help="Employee's company bike.",
        groups='fleet.fleet_group_manager')
    company_bike_depreciated_cost = fields.Float(compute='_compute_company_bike_depreciated_cost', store=True, compute_sudo=True)
    new_bike_model_id = fields.Many2one(
        'fleet.vehicle.model', string="Bike Model", domain=lambda self: self._get_possible_model_domain(vehicle_type='bike'))

    @api.depends('employee_id')
    def _compute_car_id(self):
        employees_partners = self.employee_id.address_home_id
        cars = self.env['fleet.vehicle'].search([('driver_id', 'in', employees_partners.ids)])
        dict_car = dict([(car.driver_id.id, car.id) for car in cars])
        for contract in self:
            partner_id = contract.employee_id.address_home_id.id
            if partner_id in dict_car:
                contract.car_id = dict_car[partner_id]
                contract.transport_mode_car = True
            else:
                contract.car_id = False

    @api.depends('car_id', 'new_car', 'new_car_model_id', 'car_id.total_depreciated_cost',
        'car_id.atn', 'new_car_model_id.default_atn', 'new_car_model_id.default_total_depreciated_cost')
    def _compute_car_atn_and_costs(self):
        self.car_atn = False
        self.company_car_total_depreciated_cost = False
        self.wishlist_car_total_depreciated_cost = False
        for contract in self:
            if not contract.new_car and contract.car_id:
                contract.car_atn = contract.car_id.atn
                contract.company_car_total_depreciated_cost = contract.car_id.total_depreciated_cost
                contract.wishlist_car_total_depreciated_cost = 0
            elif contract.new_car and contract.new_car_model_id:
                contract.car_atn = contract.new_car_model_id.default_atn
                contract.company_car_total_depreciated_cost = contract.new_car_model_id.default_total_depreciated_cost
                contract.wishlist_car_total_depreciated_cost = contract.new_car_model_id.default_total_depreciated_cost


    @api.depends('bike_id', 'new_bike_model_id', 'bike_id.total_depreciated_cost',
        'bike_id.co2_fee', 'new_bike_model_id.default_total_depreciated_cost', 'transport_mode_bike')
    def _compute_company_bike_depreciated_cost(self):
        for contract in self:
            contract.company_bike_depreciated_cost = False
            if contract.transport_mode_bike:
                if contract.bike_id:
                    contract.company_bike_depreciated_cost = contract.bike_id.total_depreciated_cost
                elif contract.new_bike_model_id:
                    contract.company_bike_depreciated_cost = contract.new_bike_model_id.default_recurring_cost_amount_depreciated

    @api.depends('car_id.log_contracts.state')
    def _compute_car_open_contracts_count(self):
        for contract in self:
            contract.car_open_contracts_count = len(contract.car_id.log_contracts.filtered(
                lambda c: c.state == 'open').ids)

    @api.depends('car_open_contracts_count', 'car_id.log_contracts.recurring_cost_amount_depreciated')
    def _compute_recurring_cost_amount_depreciated(self):
        for contract in self:
            if contract.car_open_contracts_count == 1:
                contract.recurring_cost_amount_depreciated = contract.car_id.log_contracts.filtered(
                    lambda c: c.state == 'open'
                ).recurring_cost_amount_depreciated
            else:
                contract.recurring_cost_amount_depreciated = 0.0

    def _inverse_recurring_cost_amount_depreciated(self):
        for contract in self:
            if contract.car_open_contracts_count == 1:
                contract.car_id.log_contracts.filtered(
                    lambda c: c.state == 'open'
                ).recurring_cost_amount_depreciated = contract.recurring_cost_amount_depreciated

    @api.depends('name')
    def _compute_available_cars_amount(self):
        for contract in self:
            contract.available_cars_amount = self.env['fleet.vehicle'].sudo().search_count(contract._get_available_vehicles_domain(contract.employee_id.address_home_id))

    @api.depends('name')
    def _compute_max_unused_cars(self):
        params = self.env['ir.config_parameter'].sudo()
        max_unused_cars = params.get_param('l10n_be_hr_payroll_fleet.max_unused_cars', default=1000)
        for contract in self:
            contract.max_unused_cars = 999999 if contract.env.context.get('is_applicant') else int(max_unused_cars)

    @api.onchange('transport_mode_car', 'transport_mode_train', 'transport_mode_public')
    def _onchange_transport_mode(self):
        super(HrContract, self)._onchange_transport_mode()
        if not self.transport_mode_car:
            self.car_id = False
            self.new_car_model_id = False
