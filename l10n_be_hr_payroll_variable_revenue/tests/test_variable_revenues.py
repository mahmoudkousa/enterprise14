# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
import unittest
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import tagged
from odoo.tools.float_utils import float_compare


@tagged('post_install', '-at_install', 'variable_revenues')
class TestVariableRevenues(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_be.l10nbe_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        # The test depends on fleet, but not the module. This module is
        # merged into l10n_be_hr_payroll in 14.1
        if "fleet.vehicle.model.brand" not in cls.env:
            return
        cls.company_data['company'].country_id = cls.env.ref('base.be')

        cls.env.user.tz = 'Europe/Brussels'

        cls.address_home = cls.env['res.partner'].create([{
            'name': "Test Employee",
            'company_id': cls.env.company.id,
            'type': "private",
        }])

        cls.resource_calendar = cls.env['resource.calendar'].create([{
            'name': "Test Calendar",
            'company_id': cls.env.company.id,
            'attendance_ids': [(5, 0, 0)],
            'hours_per_day': 7.6,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 38.0,
            'full_time_required_hours': 38.0
        }])

        cls.global_attendances = cls.env['resource.calendar.attendance'].create([{
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "0",
            'date_from': False,
            'date_to': False,
            'hour_from': 8.0,
            'hour_to': 12.0,
            'day_period': "morning",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 9,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "0",
            'date_from': False,
            'date_to': False,
            'hour_from': 13.0,
            'hour_to': 16.6,
            'day_period': "afternoon",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 10,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "1",
            'date_from': False,
            'date_to': False,
            'hour_from': 8.0,
            'hour_to': 12.0,
            'day_period': "morning",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 11,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "1",
            'date_from': False,
            'date_to': False,
            'hour_from': 13.0,
            'hour_to': 16.6,
            'day_period': "afternoon",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 12,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "2",
            'date_from': False,
            'date_to': False,
            'hour_from': 8.0,
            'hour_to': 12.0,
            'day_period': "morning",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 13,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "2",
            'date_from': False,
            'date_to': False,
            'hour_from': 13.0,
            'hour_to': 16.6,
            'day_period': "afternoon",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 14,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "3",
            'date_from': False,
            'date_to': False,
            'hour_from': 8.0,
            'hour_to': 12.0,
            'day_period': "morning",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 8,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "3",
            'date_from': False,
            'date_to': False,
            'hour_from': 13.0,
            'hour_to': 16.6,
            'day_period': "afternoon",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 7,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "4",
            'date_from': False,
            'date_to': False,
            'hour_from': 8.0,
            'hour_to': 12.0,
            'day_period': "morning",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 6,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }, {
            'name': "Attendance",
            'calendar_id': cls.resource_calendar.id,
            'dayofweek': "4",
            'date_from': False,
            'date_to': False,
            'hour_from': 13.0,
            'hour_to': 16.6,
            'day_period': "afternoon",
            'resource_id': False,
            'week_type': False,
            'display_type': False,
            'sequence': 5,
            'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id
        }])

        cls.leaves = cls.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'date_from': datetime.datetime(2020, 9, 23, 5, 0, 0),
            'date_to': datetime.datetime(2020, 9, 23, 16, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': cls.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }])

        cls.employee = cls.env['hr.employee'].create([{
            'name': "Test Employee",
            'address_home_id': cls.address_home.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'marital': "single",
            'children': 0,
            'km_home_work': 75,
            'spouse_fiscal_status': "without_income",
            'disabled': False,
            'disabled_spouse_bool': False,
            'disabled_children_bool': False,
            'resident_bool': False,
            'disabled_children_number': 0,
            'other_dependent_people': False,
            'other_senior_dependent': 0,
            'other_disabled_senior_dependent': 0,
            'other_juniors_dependent': 0,
            'other_disabled_juniors_dependent': 0,
            'has_bicycle': False
        }])

        cls.brand = cls.env['fleet.vehicle.model.brand'].create([{
            'name': "Test Brand"
        }])

        cls.model = cls.env['fleet.vehicle.model'].create([{
            'name': "Test Model",
            'brand_id': cls.brand.id
        }])

        cls.car = cls.env['fleet.vehicle'].create([{
            'name': "Test Car",
            'license_plate': "TEST",
            'driver_id': cls.employee.address_home_id.id,
            'company_id': cls.env.company.id,
            'model_id': cls.model.id,
            'first_contract_date': datetime.date(2020, 10, 23),
            'co2': 88.0,
            'car_value': 38000.0,
            'fuel_type': "diesel",
            'acquisition_date': datetime.date(2020, 1, 1)
        }])

        cls.contracts = cls.env['fleet.vehicle.log.contract'].create([{
            'name': "Test Contract",
            'vehicle_id': cls.car.id,
            'company_id': cls.env.company.id,
            'start_date': datetime.date(2020, 10, 23),
            'expiration_date': datetime.date(2021, 10, 23),
            'state': "open",
            'cost_generated': 0.0,
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 0.0
        }, {
            'name': "Test Contract",
            'vehicle_id': cls.car.id,
            'company_id': cls.env.company.id,
            'start_date': datetime.date(2020, 10, 23),
            'expiration_date': datetime.date(2021, 10, 23),
            'state': "open",
            'cost_generated': 0.0,
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 450.0
        }])

        cls.contract = cls.env['hr.contract'].create([{
            'name': "Contract For Payslip Test",
            'employee_id': cls.employee.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'date_generated_from': datetime.datetime(2020, 3, 1, 0, 0, 0),
            'date_generated_to': datetime.datetime(2020, 3, 1, 0, 0, 0),
            'car_id': cls.car.id,
            'structure_type_id': cls.env.ref('hr_contract.structure_type_employee_cp200').id,
            'date_start': datetime.date(2020, 1, 15),
            'date_end': False,
            'wage': 2650.0,
            'state': "open",
            'holidays': 0.0,
            'hourly_wage': 0.0,
            'transport_mode_car': True,
            'transport_mode_private_car': False,
            'transport_mode_train': False,
            'transport_mode_public': False,
            'train_transport_employee_amount': 0.0,
            'public_transport_employee_amount': 0.0,
            'others_reimbursed_amount': 0.0,
            'commission_on_target': 1000,
            'fuel_card': 150.0,
            'internet': 38.0,
            'representation_fees': 150.0,
            'mobile': 30.0,
            'has_laptop': False,
            'meal_voucher_amount': 7.45,
            'eco_checks': 250.0,
            'ip': True,
            'ip_wage_rate': 25.0,
            'time_credit': False,
            'work_time_rate': False,
            'fiscal_voluntarism': False,
            'fiscal_voluntary_rate': 0.0
        }])

        cls.commission_payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': cls.employee.id,
            'contract_id': cls.contract.id,
            'company_id': cls.env.company.id,
            'vehicle_id': cls.car.id,
            'struct_id': cls.env.ref('l10n_be_hr_payroll_variable_revenue.hr_payroll_structure_cp200_structure_commission').id,
            'date_from': datetime.date(2020, 3, 1),
            'date_to': datetime.date(2020, 3, 31)
        }])

        cls.inputs = cls.env['hr.payslip.input'].create([{
            'name': "Test Input",
            'payslip_id': cls.commission_payslip.id,
            'sequence': 10,
            'input_type_id': cls.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_other_input_commission').id,
            'amount': 8484.0
        }])


        cls.classic_payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': cls.employee.id,
            'contract_id': cls.contract.id,
            'company_id': cls.env.company.id,
            'vehicle_id': cls.car.id,
            'struct_id': cls.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary').id,
            'date_from': datetime.date(2020, 9, 1),
            'date_to': datetime.date(2020, 9, 30)
        }])


    def test_variable_revenues(self):
        # The test depends on fleet, but not the module. This module is
        # merged into l10n_be_hr_payroll in 14.1
        if "fleet.vehicle.model.brand" not in self.env:
            raise unittest.SkipTest("This test need l10n_be_hr_payroll_fleet")
        work_entries = self.contract._generate_work_entries(datetime.date(2020, 3, 1), datetime.date(2020, 3, 31))
        work_entries.action_validate()
        self.commission_payslip._onchange_employee()
        self.commission_payslip.input_line_ids.amount = 8484.0
        self.commission_payslip.compute_sheet()
        self.commission_payslip.action_payslip_done()

        self.assertEqual(len(self.commission_payslip.worked_days_line_ids), 0)
        self.assertEqual(len(self.commission_payslip.input_line_ids), 1)
        self.assertEqual(len(self.commission_payslip.line_ids), 16)

        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('BASIC'), 2650.0, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('COM'), 8484.0, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('SALARY'), 11134.0, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('ONSS'), -1455.21, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('GROSS'), 9678.79, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('P.P'), -4336.88, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('M.ONSS'), -60.94, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('ONSS.ADJ'), 346.36, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('P.P.ADJ'), 636.82, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('M.ONSS.ADJ'), 23.66, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('BASIC.ADJ'), -2650.0, places=2)
        self.assertAlmostEqual(self.commission_payslip._get_salary_line_total('NET'), 3637.8, places=2)

        work_entries = self.contract._generate_work_entries(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))
        work_entries.action_validate()
        self.classic_payslip._onchange_employee()
        self.classic_payslip.compute_sheet()

        self.assertEqual(len(self.classic_payslip.worked_days_line_ids), 3)
        self.assertEqual(len(self.classic_payslip.input_line_ids), 0)
        self.assertEqual(len(self.classic_payslip.line_ids), 23)

        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_amount('LEAVE500'), 122.31, places=2)
        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_amount('WORK100'), 2527.69, places=2)
        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_amount('LEAVE1731'), 58.18, places=2)

        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_number_of_days('LEAVE500'), 1.0, places=2)
        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_number_of_days('WORK100'), 21.0, places=2)
        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_number_of_days('LEAVE1731'), 0.0, places=2)

        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_number_of_hours('LEAVE500'), 7.6, places=2)
        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_number_of_hours('WORK100'), 159.6, places=2)
        self.assertAlmostEqual(self.classic_payslip._get_worked_days_line_number_of_hours('LEAVE1731'), 0.0, places=2)

        payslip_result = {
            'BASIC': 2708.18,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2717.18,
            'ONSS': -355.14,
            'ATN.CAR': 141.14,
            'GROSSIP': 2503.19,
            'IP.PART': -677.05,
            'GROSS': 1826.14,
            'P.P': -253.1,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -24.3,
            'MEAL_V_EMP': -22.89,
            'REP.FEES': 150.0,
            'IP': 677.05,
            'IP.DED': -50.78,
            'NET': 2151.98,
        }
        error = []
        for code, value in payslip_result.items():
            payslip_line_value = self.classic_payslip._get_salary_line_total(code)
            if float_compare(payslip_line_value, value, 2):
                error.append("Computed line %s should have an amount = %s instead of %s" % (code, value, payslip_line_value))
        self.assertEqual(len(error), 0, '\n' + '\n'.join(error))
