# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, _
from odoo.addons.hr_contract_salary.controllers.main import HrContractSalary
from odoo.addons.sign.controllers.main import Sign
from odoo.http import route, request


class SignContract(Sign):

    def _update_contract_on_signature(self, request_item, contract):
        super()._update_contract_on_signature(request_item, contract)
        # Only the applicant/employee has signed
        if request_item.sign_request_id.nb_closed == 1 and contract.car_id:
            if contract.car_id and contract.driver_id != contract.employee_id.address_home_id:
                contract.car_id.future_driver_id = contract.employee_id.address_home_id
        # Both applicant/employee and HR responsible have signed
        if request_item.sign_request_id.nb_closed == 2:
            if contract.new_car or contract.new_bike_model_id:
                state_new_request = request.env.ref('fleet.fleet_vehicle_state_new_request', raise_if_not_found=False)
                Vehicle = request.env['fleet.vehicle'].sudo()
                vehicle_vals = {
                    'state_id': state_new_request and state_new_request.id,
                    'future_driver_id': contract.employee_id.address_home_id.id,
                    'company_id': contract.company_id.id,
                }
                contracts_vals = {
                    'cost_frequency': 'no',
                    'purchaser_id': contract.employee_id.address_home_id.id,
                }
            if contract.new_car:
                model = contract.new_car_model_id.sudo()
                contract.car_id = Vehicle.create(dict(vehicle_vals, **{
                    'model_id': model.id,
                    'car_value': model.default_car_value,
                    'co2': model.default_co2,
                    'fuel_type': model.default_fuel_type,
                }))
                contract.new_car = False
                contract.new_car_model_id = False
                vehicle_contract = contract.car_id.log_contracts[0]
                vehicle_contract.write(dict(contracts_vals , **{
                    'recurring_cost_amount_depreciated': model.default_recurring_cost_amount_depreciated,
                    'cost_generated': model.default_recurring_cost_amount_depreciated,
                }))
            if contract.new_bike_model_id:
                model = contract.new_bike_model_id.sudo()
                contract.bike_id = Vehicle.create(dict(vehicle_vals, **{
                    'model_id': model.id,
                    'car_value': model.default_car_value,
                    'co2': model.default_co2,
                    'fuel_type': model.default_fuel_type,
                }))
                contract.new_bike_model_id = False
                vehicle_contract = contract.bike_id.log_contracts[0]
                vehicle_contract.write(dict(contracts_vals , **{
                    'recurring_cost_amount_depreciated': model.default_recurring_cost_amount_depreciated,
                    'cost_generated': model.default_recurring_cost_amount_depreciated,
                }))

class HrContractSalary(HrContractSalary):

    @route(['/salary_package/onchange_advantage/'], type='json', auth='public')
    def onchange_advantage(self, advantage_field, new_value, contract_id, advantages):
        res = super().onchange_advantage(advantage_field, new_value, contract_id, advantages)
        if advantage_field == 'public_transport_reimbursed_amount':
            new_value = new_value if new_value else 0
            res['new_value'] = round(request.env['hr.contract']._get_public_transport_reimbursed_amount(float(new_value)), 2)
        elif advantage_field == 'train_transport_reimbursed_amount':
            new_value = new_value if new_value else 0
            res['new_value'] = round(request.env['hr.contract']._get_train_transport_reimbursed_amount(float(new_value)), 2)
        elif advantage_field in ['private_car_reimbursed_amount', 'km_home_work']:
            new_value = new_value if new_value else 0
            if advantage_field == 'km_home_work':
                res['extra_values'] = [('private_car_reimbursed_amount_manual', new_value)]
            else:
                res['new_value'] = round(request.env['hr.contract']._get_private_car_reimbursed_amount(float(new_value)), 2)
                res['extra_values'] = [('km_home_work', new_value)]
        elif advantage_field == 'ip_value':
            contract = self._check_access_rights(contract_id)
            res['new_value'] = contract.ip_wage_rate if int(new_value) else 0
        elif advantage_field in ['company_car_total_depreciated_cost', 'company_bike_depreciated_cost'] and new_value:
            car_options, vehicle_id = new_value.split('-')
            if car_options == 'new':
                res['new_value'] = round(request.env['fleet.vehicle.model'].sudo().browse(int(vehicle_id)).default_total_depreciated_cost, 2)
            else:
                res['new_value'] = round(request.env['fleet.vehicle'].sudo().browse(int(vehicle_id)).total_depreciated_cost, 2)
        elif advantage_field == 'wishlist_car_total_depreciated_cost':
            dummy, vehicle_id = new_value.split('-')
            res['new_value'] = 0
        elif advantage_field == 'fold_company_car_total_depreciated_cost' and not res['new_value']:
            res['extra_values'] = [('company_car_total_depreciated_cost', 0)]
        elif advantage_field == 'fold_wishlist_car_total_depreciated_cost' and not res['new_value']:
            res['extra_values'] = [('wishlist_car_total_depreciated_cost', 0)]
        elif advantage_field == 'fold_company_bike_depreciated_cost' and not res['new_value']:
            res['extra_values'] = [('company_bike_depreciated_cost', 0)]
        return res

    def _get_advantages(self, contract):
        res = super()._get_advantages(contract)
        if contract.available_cars_amount < contract.max_unused_cars:
            res -= request.env.ref('l10n_be_hr_contract_salary.l10n_be_transport_new_car')
        return res

    def _get_advantages_values(self, contract):
        mapped_advantages, advantage_types, dropdown_options, initial_values = super()._get_advantages_values(contract)

        available_cars = request.env['fleet.vehicle'].sudo().search(
            contract._get_available_vehicles_domain(contract.employee_id.address_home_id)).sorted(key=lambda car: car.total_depreciated_cost)
        available_bikes = request.env['fleet.vehicle'].sudo().search(
            contract._get_available_vehicles_domain(contract.employee_id.address_home_id, vehicle_type='bike')).sorted(key=lambda car: car.total_depreciated_cost)
        dropdown_options['company_car_total_depreciated_cost'] = [(
            'old-%s' % (car.id),
            '%s/%s/ \u2022 %s € \u2022 %s%s' % (
                car.model_id.brand_id.name,
                car.model_id.name,
                round(car.total_depreciated_cost, 2),
                car._get_acquisition_date(),
                '\u2022 Available in %s' % car.next_assignation_date.strftime('%B %Y') if car.next_assignation_date else u''
            )
        ) for car in available_cars]
        dropdown_options['company_bike_depreciated_cost'] = [(
            'old-%s' % (bike.id),
            '%s/%s/ \u2022 %s € \u2022 %s' % (
                bike.model_id.brand_id.name,
                bike.model_id.name,
                round(bike.total_depreciated_cost, 2),
                '\u2022 Available in %s' % bike.next_assignation_date.strftime('%B %Y') if bike.next_assignation_date else u''
            )
        ) for bike in available_bikes]

        can_be_requested_models = request.env['fleet.vehicle.model'].sudo().search(
        contract._get_possible_model_domain()).sorted(key=lambda model: model.default_total_depreciated_cost)
        new_car_options = [(
            'new-%s' % (model.id),
            '%s \u2022 %s € \u2022 New Car' % (
                model.display_name,
                round(model.default_total_depreciated_cost, 2),
            )
        ) for model in can_be_requested_models]
        can_be_requested_models = request.env['fleet.vehicle.model'].sudo().search(
        contract._get_possible_model_domain(vehicle_type='bike')).sorted(key=lambda model: model.default_total_depreciated_cost)
        new_bike_options = [(
            'new-%s' % (model.id),
            '%s \u2022 %s € \u2022 New Bike' % (
                model.display_name,
                round(model.default_total_depreciated_cost, 2),
            )
        ) for model in can_be_requested_models]
        dropdown_options['company_bike_depreciated_cost'] += new_bike_options

        if contract.available_cars_amount < contract.max_unused_cars:
            dropdown_options['company_car_total_depreciated_cost'] += new_car_options
        else:
            dropdown_options['wishlist_car_total_depreciated_cost'] = new_car_options
            initial_values['fold_wishlist_car_total_depreciated_cost'] = False
            initial_values['wishlist_car_total_depreciated_cost'] = 0


        if contract.car_id:
            initial_values['select_company_car_total_depreciated_cost'] = 'old-%s' % contract.car_id.id
            initial_values['fold_company_car_total_depreciated_cost'] = True
            initial_values['company_car_total_depreciated_cost'] = contract.car_id.total_depreciated_cost
        elif contract.new_car_model_id:
            initial_values['select_company_car_total_depreciated_cost'] = 'new-%s' % contract.new_car_model_id.id
            initial_values['fold_company_car_total_depreciated_cost'] = True
            initial_values['company_car_total_depreciated_cost'] = contract.new_car_model_id.default_total_depreciated_cost
        else:
            initial_values['fold_company_car_total_depreciated_cost'] = False
        if contract.bike_id:
            initial_values['select_company_bike_depreciated_cost'] = 'old-%s' % contract.bike_id.id
        elif contract.new_bike_model_id:
            initial_values['select_company_bike_depreciated_cost'] = 'new-%s' % contract.new_bike_model_id.id

        return mapped_advantages, advantage_types, dropdown_options, initial_values

    def _get_new_contract_values(self, contract, employee, advantages):
        res = super()._get_new_contract_values(contract, employee, advantages)
        fields_to_copy = ['has_laptop', 'rd_percentage', 'no_onss', 'no_withholding_taxes']
        for field_to_copy in fields_to_copy:
            if field_to_copy in contract:
                res[field_to_copy] = contract[field_to_copy]
        return res

    def create_new_contract(self, contract, advantages, no_write=False, **kw):
        contract = super().create_new_contract(contract, advantages, no_write=no_write, **kw)
        if kw.get('package_submit', False):
            # If the chosen existing car is already taken by someone else (for example if the
            # window was open for a long time)
            if contract.transport_mode_car and not contract.new_car:
                available_cars_domain = contract._get_available_vehicles_domain(contract.employee_id.address_home_id)
                if contract.car_id not in request.env['fleet.vehicle'].sudo().search(available_cars_domain):
                    return {'error': True, 'error_msg': _("Sorry, the selected car has been selected by someone else. Please refresh and try again.")}

            # Don't create simulation cars but create the wishlist car is set
            wishlist_car = advantages['contract'].get('fold_wishlist_car_total_depreciated_cost', False)
            if wishlist_car:
                dummy, model_id = advantages['contract']['select_wishlist_car_total_depreciated_cost'].split('-')
                model = request.env['fleet.vehicle.model'].sudo().browse(int(model_id))
                state_waiting_list = request.env.ref('fleet.fleet_vehicle_state_waiting_list', raise_if_not_found=False)
                car = request.env['fleet.vehicle'].sudo().create({
                    'model_id': model.id,
                    'state_id': state_waiting_list and state_waiting_list.id,
                    'car_value': model.default_car_value,
                    'co2': model.default_co2,
                    'fuel_type': model.default_fuel_type,
                    'acquisition_date': contract.car_id.acquisition_date or fields.Date.today(),
                    'company_id': contract.company_id.id,
                    'future_driver_id': contract.employee_id.address_home_id.id
                })
                vehicle_contract = car.log_contracts[0]
                vehicle_contract.recurring_cost_amount_depreciated = model.default_recurring_cost_amount_depreciated
                vehicle_contract.cost_generated = model.default_recurring_cost_amount_depreciated
                vehicle_contract.cost_frequency = 'no'
                vehicle_contract.purchaser_id = contract.employee_id.address_home_id.id
            return contract


        if contract.transport_mode_car and contract.new_car:
            employee = contract.employee_id
            model = contract.new_car_model_id
            state_new_request = request.env.ref('fleet.fleet_vehicle_state_new_request', raise_if_not_found=False)
            contract.car_id = request.env['fleet.vehicle'].sudo().create({
                'model_id': model.id,
                'state_id': state_new_request and state_new_request.id,
                'driver_id': employee.address_home_id.id,
                'car_value': model.default_car_value,
                'co2': model.default_co2,
                'fuel_type': model.default_fuel_type,
                'company_id': contract.company_id.id,
            })
            vehicle_contract = contract.car_id.log_contracts[0]
            vehicle_contract.recurring_cost_amount_depreciated = model.default_recurring_cost_amount_depreciated
            vehicle_contract.cost_generated = model.default_recurring_cost_amount_depreciated
            vehicle_contract.cost_frequency = 'no'
            vehicle_contract.purchaser_id = employee.address_home_id.id
        return contract

    def _get_compute_results(self, new_contract):
        result = super()._get_compute_results(new_contract)
        result['double_holiday_wage'] = round(new_contract.double_holiday_wage, 2)
        return result

    def _generate_payslip(self, new_contract):
        payslip = super()._generate_payslip(new_contract)
        if new_contract.car_id:
            payslip.vehicle_id = new_contract.car_id
        return payslip
