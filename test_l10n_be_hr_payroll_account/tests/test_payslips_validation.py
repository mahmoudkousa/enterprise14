# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import time
import datetime

from odoo.tests.common import SavepointCase, tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tools.float_utils import float_compare


@tagged('post_install', '-at_install', 'payslips_validation')
class TestPayslipValidation(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_be.l10nbe_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.date_from = datetime.date(2020, 9, 1)
        cls.date_to = datetime.date(2020, 9, 30)

        cls.company_data['company'].country_id = cls.env.ref('base.be')

        cls.env.user.tz = 'Europe/Brussels'

        cls.address_home = cls.env['res.partner'].create([{
            'name': "Test Employee",
            'company_id': cls.env.company.id,
            'type': "private"
        }])

        cls.resource_calendar_38_hours_per_week = cls.env['resource.calendar'].create([{
            'name': "Test Calendar : 38 Hours/Week",
            'company_id': cls.env.company.id,
            'hours_per_day': 7.6,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 38.0,
            'full_time_required_hours': 38.0,
            'attendance_ids': [(5, 0, 0)] + [(0, 0, {
                'name': "Attendance",
                'dayofweek': dayofweek,
                'hour_from': hour_from,
                'hour_to': hour_to,
                'day_period': day_period,
                'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id

            }) for dayofweek, hour_from, hour_to, day_period in [
                ("0", 8.0, 12.0, "morning"),
                ("0", 13.0, 16.6, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 13.0, 16.6, "afternoon"),
                ("2", 8.0, 12.0, "morning"),
                ("2", 13.0, 16.6, "afternoon"),
                ("3", 8.0, 12.0, "morning"),
                ("3", 13.0, 16.6, "afternoon"),
                ("4", 8.0, 12.0, "morning"),
                ("4", 13.0, 16.6, "afternoon"),

            ]],
        }])

        cls.resource_calendar_4_5_wednesday_off = cls.env['resource.calendar'].create([{
            'name': "Test Calendar: 4/5 Wednesday Off",
            'company_id': cls.env.company.id,
            'hours_per_day': 7.6,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 38.0,
            'full_time_required_hours': 38.0,
            'attendance_ids': [(5, 0, 0)] + [(0, 0, {
                'name': "Attendance",
                'dayofweek': dayofweek,
                'hour_from': hour_from,
                'hour_to': hour_to,
                'day_period': day_period,
                'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id

            }) for dayofweek, hour_from, hour_to, day_period in [
                ("0", 8.0, 12.0, "morning"),
                ("0", 13.0, 16.6, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 13.0, 16.6, "afternoon"),
                ("3", 8.0, 12.0, "morning"),
                ("3", 13.0, 16.6, "afternoon"),
                ("4", 8.0, 12.0, "morning"),
                ("4", 13.0, 16.6, "afternoon"),

            ]],
        }])

        cls.resource_calendar_4_5_thurday_off = cls.env['resource.calendar'].create([{
            'name': "Test Calendar: 4/5 Thursday Off",
            'company_id': cls.env.company.id,
            'hours_per_day': 7.6,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 38.0,
            'full_time_required_hours': 38.0,
            'attendance_ids': [(5, 0, 0)] + [(0, 0, {
                'name': "Attendance",
                'dayofweek': dayofweek,
                'hour_from': hour_from,
                'hour_to': hour_to,
                'day_period': day_period,
                'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id

            }) for dayofweek, hour_from, hour_to, day_period in [
                ("0", 8.0, 12.0, "morning"),
                ("0", 13.0, 16.6, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 13.0, 16.6, "afternoon"),
                ("2", 8.0, 12.0, "morning"),
                ("2", 13.0, 16.6, "afternoon"),
                ("4", 8.0, 12.0, "morning"),
                ("4", 13.0, 16.6, "afternoon"),

            ]],
        }])

        cls.resource_calendar_half_time = cls.env['resource.calendar'].create([{
            'name': "Test Calendar: Half Time",
            'company_id': cls.env.company.id,
            'hours_per_day': 6.33,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 19.0,
            'full_time_required_hours': 38.0,
            'attendance_ids': [(5, 0, 0)] + [(0, 0, {
                'name': "Attendance",
                'dayofweek': dayofweek,
                'hour_from': hour_from,
                'hour_to': hour_to,
                'day_period': day_period,
                'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id

            }) for dayofweek, hour_from, hour_to, day_period in [
                ("0", 8.0, 12.0, "morning"),
                ("0", 13.0, 16.6, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 13.0, 16.6, "afternoon"),
                ("2", 8.0, 11.8, "morning"),
            ]],
        }])

        cls.resource_calendar_0_hours_per_week = cls.env['resource.calendar'].create([{
            'name': "Test Calendar: 0 Hours per week",
            'company_id': cls.env.company.id,
            'hours_per_day': 0,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 0,
            'full_time_required_hours': 38,
            'attendance_ids': [(5, 0, 0)],
        }])

        cls.employee = cls.env['hr.employee'].create([{
            'name': "Test Employee",
            'address_home_id': cls.address_home.id,
            'resource_calendar_id': cls.resource_calendar_38_hours_per_week.id,
            'company_id': cls.env.company.id,
            'km_home_work': 75,
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
            'first_contract_date': datetime.date(2020, 10, 8),
            'co2': 88.0,
            'car_value': 38000.0,
            'fuel_type': "diesel",
            'acquisition_date': datetime.date(2020, 1, 1)
        }])

        cls.vehicle_contract = cls.env['fleet.vehicle.log.contract'].create({
            'name': "Test Contract",
            'vehicle_id': cls.car.id,
            'company_id': cls.env.company.id,
            'start_date': datetime.date(2020, 10, 8),
            'expiration_date': datetime.date(2021, 10, 8),
            'state': "open",
            'cost_generated': 0.0,
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 450.0
        })

        cls.contract = cls.env['hr.contract'].create([{
            'name': "Contract For Payslip Test",
            'employee_id': cls.employee.id,
            'resource_calendar_id': cls.resource_calendar_38_hours_per_week.id,
            'company_id': cls.env.company.id,
            'date_generated_from': datetime.datetime(2020, 9, 1, 0, 0, 0),
            'date_generated_to': datetime.datetime(2020, 9, 1, 0, 0, 0),
            'car_id': cls.car.id,
            'structure_type_id': cls.env.ref('hr_contract.structure_type_employee_cp200').id,
            'date_start': datetime.date(2018, 12, 31),
            'wage': 2650.0,
            'state': "open",
            'transport_mode_car': True,
            'fuel_card': 150.0,
            'internet': 38.0,
            'representation_fees': 150.0,
            'mobile': 30.0,
            'meal_voucher_amount': 7.45,
            'eco_checks': 250.0,
            'ip_wage_rate': 25.0,
            'ip': True,
        }])

        cls.sick_time_off_type = cls.env['hr.leave.type'].create({
            'name': 'Sick Time Off',
            'allocation_type': 'no',
            'work_entry_type_id': cls.env.ref('hr_work_entry_contract.work_entry_type_sick_leave').id,
        })

        cls.long_term_sick_time_off_type = cls.env['hr.leave.type'].create({
            'name': 'Sick Time Off',
            'allocation_type': 'no',
            'work_entry_type_id': cls.env.ref('l10n_be_hr_payroll.work_entry_type_long_sick').id,
        })

    @classmethod
    def _generate_payslip(cls, date_from, date_to):
        payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': cls.employee.id,
            'contract_id': cls.contract.id,
            'company_id': cls.env.company.id,
            'vehicle_id': cls.car.id,
            'struct_id': cls.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary').id,
            'date_from': date_from,
            'date_to': date_to,
        }])
        work_entries = cls.contract._generate_work_entries(date_from, date_to)
        work_entries.action_validate()
        payslip._onchange_employee()
        payslip.compute_sheet()
        return payslip

    def _validate_payslip(self, payslip, results):
        error = []
        for code, value in results.items():
            payslip_line_value = payslip._get_salary_line_total(code)
            if float_compare(payslip_line_value, value, 2):
                error.append("Computed line %s should have an amount = %s instead of %s" % (code, value, payslip_line_value))
        self.assertEqual(len(error), 0, '\n' + '\n'.join(error))

    def _validate_move_lines(self, lines, results):
        error = []
        for code, move_type, amount in results:
            if not any(l.account_id.code == code and not float_compare(l[move_type], amount, 2) for l in lines):
                error.append("Couldn't find %s move line on account %s with amount %s" % (move_type, code, amount))
        if error:
            for line in lines:
                for move_type in ['credit', 'debit']:
                    if line[move_type]:
                        error.append('%s - %s - %s' % (line.account_id.code, move_type, line[move_type]))
        self.assertEqual(len(error), 0, '\n' + '\n'.join(error))

    def test_low_salary(self):
        self.contract.wage = 1800
        self.contract.ip = False

        payslip = self._generate_payslip(self.date_from, self.date_to)

        self.assertEqual(len(payslip.worked_days_line_ids), 1)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1800.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 22.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 167.2, places=2)

        payslip_results = {
            'BASIC': 1800.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1809.0,
            'ONSS': -236.44,
            'EmpBonus.1': 176.14,
            'ATN.CAR': 141.14,
            'GROSS': 1889.85,
            'P.P': -278.78,
            'P.P.DED': 58.37,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -23.98,
            'REP.FEES': 150.0,
            'NET': 1645.31,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_end_of_contract(self):
        self.contract.date_end = datetime.date(2020, 9, 21)
        self.contract.ip = False

        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 14, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('test_l10n_be_hr_payroll_account.work_entry_type_phc').id
        }])

        payslip = self._generate_payslip(self.date_from, self.date_to)

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('PHC1'), 122.31, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1671.54, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('OUT'), 0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('PHC1'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 14.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('OUT'), 7.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('PHC1'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 106.4, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('OUT'), 53.2, places=2)

        payslip_results = {
            'BASIC': 1793.85,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1802.85,
            'ONSS': -235.63,
            'EmpBonus.1': 177.49,
            'ATN.CAR': 141.14,
            'GROSS': 1885.85,
            'P.P': -278.78,
            'P.P.DED': 58.82,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -15.26,
            'REP.FEES': 94.62,
            'NET': 1595.10,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_out_of_contract_credit_time(self):
        # The employee is on 4/5 credit time (wednesday off) from the 16 of September 2020
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week,
            'time_credit': True,
            'work_time_rate': "0.8",
            'wage': 2120.0,
            'date_start': datetime.date(2020, 9, 16),
            'date_end': datetime.date(2020, 12, 31),
        })
        payslip = self._generate_payslip(self.date_from, self.date_to)

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1141.54, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('OUT'), 0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 3.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 8.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('OUT'), 11.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 22.8, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 60.8, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('OUT'), 83.6, places=2)

        payslip_results = {
            'BASIC': 1141.54,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1150.54,
            'ONSS': -150.38,
            'EmpBonus.1': 150.38,
            'ATN.CAR': 141.14,
            'GROSSIP': 1291.68,
            'IP.PART': -285.39,
            'GROSS': 1006.30,
            'P.P': -13.42,
            'P.P.DED': 13.42,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -8.72,
            'REP.FEES': 28.85,
            'IP': 285.39,
            'IP.DED': -21.40,
            'NET': 1140.26,
        }
        self._validate_payslip(payslip, payslip_results)

    # If there is a public holiday less than 30 days after the end of the
    # contract, the employee should be paid for that day too
    def test_out_of_contract_public_holiday(self):
        self.contract.date_end = datetime.date(2020, 9, 15)

        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'date_from': datetime.datetime(2020, 9, 22, 5, 0, 0),
            'date_to': datetime.datetime(2020, 9, 22, 16, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }])

        payslip = self._generate_payslip(self.date_from, self.date_to)

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('OUT'), 0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE510'), 60.21, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1244.4, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('OUT'), 11.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE510'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 11.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('OUT'), 83.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE510'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 83.6, places=2)

        payslip_results = {
            'BASIC': 1304.61,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1313.61,
            'ONSS': -171.69,
            'EmpBonus.1': 171.69,
            'ATN.CAR': 141.14,
            'GROSSIP': 1454.75,
            'IP.PART': -326.15,
            'GROSS': 1128.60,
            'P.P': -35.89,
            'P.P.DED': 35.89,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -11.99,
            'REP.FEES': 73.85,
            'IP': 326.15,
            'IP.DED': -24.46,
            'NET': 1342.0,
        }
        self._validate_payslip(payslip, payslip_results)


    def test_end_of_contract_no_public_leave_right(self):
        # Check that only 1 day is taken into account (not 3) + Check it becomes 0 if another
        # contract is following
        self.contract.date_end = datetime.date(2020, 10, 13)
        self.contract.ip = False

        self.env['resource.calendar.leaves'].create([{
            'name': 'Armistice',
            'date_from': datetime.datetime.strptime('2020-11-11 07:00:00', '%Y-%m-%d %H:%M:%S'),
            'date_to': datetime.datetime.strptime('2020-11-11 18:00:00', '%Y-%m-%d %H:%M:%S'),
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id,
            'time_type': 'leave',
        }, {
            'name': 'Noel',
            'date_from': datetime.datetime.strptime('2020-12-25 07:00:00', '%Y-%m-%d %H:%M:%S'),
            'date_to': datetime.datetime.strptime('2020-12-25 18:00:00', '%Y-%m-%d %H:%M:%S'),
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id,
            'time_type': 'leave',
        }, {
            'name': 'Nouvel An',
            'date_from': datetime.datetime.strptime('2021-01-01 07:00:00', '%Y-%m-%d %H:%M:%S'),
            'date_to': datetime.datetime.strptime('2021-01-01 18:00:00', '%Y-%m-%d %H:%M:%S'),
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id,
            'time_type': 'leave',
        }])

        payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE510'), 48.92, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE510'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE510'), 7.6, places=2)

        new_contract = self.env['hr.contract'].create([{
            'name': "New Contract For Payslip Test",
            'employee_id': self.employee.id,
            'resource_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'date_generated_from': datetime.datetime(2020, 9, 1, 0, 0, 0),
            'date_generated_to': datetime.datetime(2020, 9, 1, 0, 0, 0),
            'car_id': self.car.id,
            'structure_type_id': self.env.ref('hr_contract.structure_type_employee_cp200').id,
            'date_start': datetime.date(2020, 10, 14),
            'date_end': False,
            'wage': 2650.0,
            'state': "open",
            'transport_mode_car': True,
            'fuel_card': 150.0,
            'internet': 38.0,
            'representation_fees': 150.0,
            'mobile': 30.0,
            'meal_voucher_amount': 7.45,
            'eco_checks': 250.0,
            'ip_wage_rate': 25.0,
            'ip': True,
        }])

        new_contract._generate_work_entries(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        payslip._onchange_employee()
        payslip.compute_sheet()

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE510'), 0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE510'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE510'), 0.0, places=2)

    def test_one_day_contract(self):
        self.contract.write({
            'date_start': datetime.date(2020, 9, 1),
            'date_end': datetime.date(2020, 9, 1),
            'ip': False,
        })
        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 81.54, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('OUT'), 0.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('OUT'), 21.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('OUT'), 159.6, places=2)

        payslip_results = {
            'BASIC': 81.54,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 90.54,
            'ONSS': -11.83,
            'EmpBonus.1': 11.83,
            'ATN.CAR': 141.14,
            'GROSS': 231.68,
            'P.P': 0.0,
            'P.P.DED': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -1.09,
            'REP.FEES': 4.62,
            'NET': 85.07,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_bank_holidays(self):
        self.contract.ip = False
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 14, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }])
        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 19)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE500'), 122.31, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2527.69, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE500'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 21.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE500'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 159.6, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSS': 2452.61,
            'P.P': -542.93,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -22.89,
            'REP.FEES': 150.0,
            'NET': 1862.99,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_public_holiday_compensation(self):
        self.contract.ip = False
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 14, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('test_l10n_be_hr_payroll_account.work_entry_type_phc').id
        }])
        public_compensation_type = self.env.ref('test_l10n_be_hr_payroll_account.work_entry_type_phc')
        # YTI TODO: master: Get rid of this.
        if 'representation_fees' in public_compensation_type:
            public_compensation_type.representation_fees = True

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 19)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('PHC1'), 122.31, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2527.69, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('PHC1'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 21.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('PHC1'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 159.6, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSS': 2452.61,
            'P.P': -542.93,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -22.89,
            'REP.FEES': 150.0,
            'NET': 1862.99,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_bank_holiday_half_days(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 15, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_legal_leave').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 16, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 16, 10, 0, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_legal_leave').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 4)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 23)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].amount, 57.94, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].amount, 64.37, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].amount, 244.62, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].amount, 2283.08, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_days, 1.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_days, 1.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_days, 2.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].number_of_days, 19.0, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_hours, 3.6, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_hours, 4.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_hours, 15.2, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].number_of_hours, 144.4, places=2)

        payslip_results = {
            'BASIC': 2650.01,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.01,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.62,
            'IP.PART': -662.5,
            'GROSS': 1790.12,
            'P.P': -240.26,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -21.8,
            'REP.FEES': 150.0,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2117.07,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_classic_credit_time(self):
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 8, 1),
            'date_end': datetime.date(2020, 11, 30),
            'wage': 2120.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })
        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2120.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 5.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 17.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 38.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 129.2, places=2)

        payslip_results = {
            'BASIC': 2120.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2129.0,
            'ONSS': -278.26,
            'EmpBonus.1': 105.93,
            'ATN.CAR': 141.14,
            'GROSSIP': 2097.81,
            'IP.PART': -530.0,
            'GROSS': 1567.81,
            'P.P': -143.96,
            'P.P.DED': 35.11,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -13.27,
            'MEAL_V_EMP': -18.53,
            'REP.FEES': 106.73,
            'IP': 530.0,
            'IP.DED': -39.75,
            'NET': 1874.0,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_credit_time_paid_time_off(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 15, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_legal_leave').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 17, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 18, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_legal_leave').id
        }])

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 8, 1),
            'date_end': datetime.date(2020, 11, 30),
            'wage': 2120.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE120'), 489.23, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1630.77, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 5.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE120'), 4.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 13.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 38.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE120'), 30.4, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 98.7999999999999, places=2)

        payslip_results = {
            'BASIC': 2120.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2129.0,
            'ONSS': -278.26,
            'EmpBonus.1': 105.93,
            'ATN.CAR': 141.14,
            'GROSSIP': 2097.81,
            'IP.PART': -530.0,
            'GROSS': 1567.81,
            'P.P': -143.96,
            'P.P.DED': 35.11,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -13.27,
            'MEAL_V_EMP': -14.17,
            'REP.FEES': 106.73,
            'IP': 530.0,
            'IP.DED': -39.75,
            'NET': 1878.36,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_credit_time_unpaid(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 15, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_unpaid_leave').id
        }])

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 8, 1),
            'date_end': datetime.date(2020, 11, 30),
            'wage': 2120.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE90'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1875.38, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 5.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE90'), 2.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 15.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 38.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE90'), 15.2, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 114.0, places=2)

        payslip_results = {
            'BASIC': 1875.38,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1884.38,
            'ONSS': -246.29,
            'EmpBonus.1': 159.6,
            'ATN.CAR': 141.14,
            'GROSSIP': 1938.83,
            'IP.PART': -468.85,
            'GROSS': 1469.99,
            'P.P': -105.44,
            'P.P.DED': 52.89,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -16.35,
            'REP.FEES': 89.42,
            'IP': 468.85,
            'IP.DED': -35.16,
            'NET': 1774.05,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_credit_time_sick(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 15, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave').id
        }])

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 8, 1),
            'date_end': datetime.date(2020, 11, 30),
            'wage': 2120.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE110'), 244.62, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1875.38, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 5.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE110'), 2.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 15.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 38.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE110'), 15.2, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 114.0, places=2)

        payslip_results = {
            'BASIC': 2120.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2129.0,
            'ONSS': -278.26,
            'EmpBonus.1': 105.93,
            'ATN.CAR': 141.14,
            'GROSSIP': 2097.81,
            'IP.PART': -530.0,
            'GROSS': 1567.81,
            'P.P': -143.96,
            'P.P.DED': 35.11,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -13.27,
            'MEAL_V_EMP': -16.35,
            'REP.FEES': 106.73,
            'IP': 530.0,
            'IP.DED': -39.75,
            'NET': 1876.18,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_credit_time_full_time(self):
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_0_hours_per_week.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 8, 1),
            'date_end': datetime.date(2020, 11, 27),
            'wage': 0.0,
            'ip': False,
            'time_credit': True,
            'work_time_rate': "0",
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 1)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 19)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 22.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 167.2, places=2)

        payslip_results = {
            'BASIC': 0.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 9.0,
            'ONSS': -1.18,
            'EmpBonus.1': 0.0,
            'ATN.CAR': 141.14,
            'GROSS': 148.97,
            'P.P': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': 0.0,
            'REP.FEES': 0.0,
            'NET': -1.18,
        }
        self._validate_payslip(payslip, payslip_results)


    def test_half_time(self):
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_half_time.id,
            'wage': 1325.0,
            'ip': False,
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].amount, 224.23, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].amount, 1100.77, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_days, 5.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_days, 9.0, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_hours, 19.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_hours, 68.4, places=2)

        payslip_results = {
            'BASIC': 1325.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1334.0,
            'ONSS': -174.35,
            'EmpBonus.1': 171.95,
            'ATN.CAR': 141.14,
            'GROSS': 1472.74,
            'P.P': -109.45,
            'P.P.DED': 56.99,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -15.26,
            'REP.FEES': 150.0,
            'NET': 1404.88,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_half_time_1_day_paid_time_off(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_half_time.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 14, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_legal_leave').id
        }])

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_half_time.id,
            'wage': 1325.0,
            'ip': False,
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 3)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        # 0 LEAVE120, 1-2 WORK100
        self.assertAlmostEqual(payslip.worked_days_line_ids[0].amount, 122.31, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].amount, 305.77, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].amount, 896.92, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_days, 1.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_days, 5.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_days, 8.0, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_hours, 7.6, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_hours, 19.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_hours, 60.8, places=2)

        payslip_results = {
            'BASIC': 1325.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1334.0,
            'ONSS': -174.35,
            'EmpBonus.1': 171.95,
            'ATN.CAR': 141.14,
            'GROSS': 1472.74,
            'P.P': -109.45,
            'P.P.DED': 56.99,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -14.17,
            'REP.FEES': 150.0,
            'NET': 1405.97,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_half_time_1_day_unpaid_time_off(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_half_time.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 16, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 16, 9, 48, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_legal_leave').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_half_time.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 21, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 21, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_unpaid_leave').id
        }])

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_half_time.id,
            'wage': 1325.0,
            'ip': False,
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 4)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE120'), 61.15, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE90'), 0.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].amount, 244.62, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].amount, 896.92, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE120'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE90'), 1.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_days, 4.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].number_of_days, 8.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE120'), 3.8, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE90'), 7.6, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_hours, 15.2, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].number_of_hours, 60.8, places=2)

        payslip_results = {
            'BASIC': 1202.69,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1211.69,
            'ONSS': -158.37,
            'EmpBonus.1': 156.19,
            'ATN.CAR': 141.14,
            'GROSS': 1350.65,
            'P.P': -78.02,
            'P.P.DED': 51.76,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -13.08,
            'REP.FEES': 138.46,
            'NET': 1299.63,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_maternity_time_off(self):
        self.public_time_off = self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'date_from': datetime.datetime(2020, 10, 6, 5, 0, 0),
            'date_to': datetime.datetime(2020, 10, 6, 16, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }])

        maternity_time_off = self.env['hr.leave'].new({
            'name': 'Maternity Time Off : 15 weeks',
            'employee_id': self.employee.id,
            'holiday_status_id': self.env.ref('l10n_be_hr_payroll.holiday_type_maternity').id,
            'request_date_from': datetime.date(2020, 9, 10),
            'request_date_to': datetime.date(2020, 12, 24),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 76,
        })
        maternity_time_off._compute_date_from_to()
        maternity_time_off = self.env['hr.leave'].create(maternity_time_off._convert_to_write(maternity_time_off._cache))

        september_payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(september_payslip.worked_days_line_ids), 2)
        self.assertEqual(len(september_payslip.input_line_ids), 0)
        self.assertEqual(len(september_payslip.line_ids), 25)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('WORK100'), 815.38, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE210'), 0.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('WORK100'), 7.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE210'), 15.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('WORK100'), 53.2, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE210'), 114.0, places=2)

        payslip_results = {
            'BASIC': 815.38,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 824.38,
            'ONSS': -107.75,
            'EmpBonus.1': 107.75,
            'ATN.CAR': 141.14,
            'GROSSIP': 965.52,
            'IP.PART': -203.85,
            'GROSS': 761.68,
            'P.P': 0.0,
            'P.P.DED': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -7.63,
            'REP.FEES': 46.15,
            'IP': 203.85,
            'IP.DED': -15.29,
            'NET': 838.62,
        }
        self._validate_payslip(september_payslip, payslip_results)

        october_payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(october_payslip.worked_days_line_ids), 2)
        self.assertEqual(len(october_payslip.input_line_ids), 0)
        self.assertEqual(len(october_payslip.line_ids), 25)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE500'), 81.54, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE210'), 0.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE500'), 1.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE210'), 21.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE500'), 7.6, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE210'), 159.6, places=2)

        payslip_results = {
            'BASIC': 81.54,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 90.54,
            'ONSS': -11.83,
            'EmpBonus.1': 11.83,
            'ATN.CAR': 141.14,
            'GROSSIP': 231.68,
            'IP.PART': -20.39,
            'GROSS': 211.3,
            'P.P': 0.0,
            'P.P.DED': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': 0.0,
            'REP.FEES': 4.62,
            'IP': 20.39,
            'IP.DED': -1.53,
            'NET': 84.63,
        }
        self._validate_payslip(october_payslip, payslip_results)

        november_payslip = self._generate_payslip(datetime.date(2020, 11, 1), datetime.date(2020, 11, 30))

        self.assertEqual(len(november_payslip.worked_days_line_ids), 1)
        self.assertEqual(len(november_payslip.input_line_ids), 0)
        self.assertEqual(len(november_payslip.line_ids), 23)

        self.assertAlmostEqual(november_payslip._get_worked_days_line_amount('LEAVE210'), 0.0, places=2)

        self.assertAlmostEqual(november_payslip._get_worked_days_line_number_of_days('LEAVE210'), 21.0, places=2)

        self.assertAlmostEqual(november_payslip._get_worked_days_line_number_of_hours('LEAVE210'), 159.6, places=2)
        payslip_results = {
            'BASIC': 0.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 9.0,
            'ONSS': -1.18,
            'EmpBonus.1': 0,
            'ATN.CAR': 141.14,
            'GROSSIP': 148.97,
            'IP.PART': 0.0,
            'GROSS': 148.97,
            'P.P': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': 0.0,
            'REP.FEES': 0.0,
            'IP': 0.0,
            'IP.DED': 0.0,
            'NET': -1.18,
        }
        self._validate_payslip(november_payslip, payslip_results)

    def test_paid_time_off_payslip(self):
        self.contract.ip = False
        self.leaves = self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 8, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 8, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_legal_leave').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 19)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE120'), 122.31, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2527.69, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE120'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 21.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE120'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 159.6, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSS': 2452.61,
            'P.P': -542.93,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -22.89,
            'REP.FEES': 150.0,
            'NET': 1862.99,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_sample_payslip_unpaid_time_off(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 8, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 9, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_unpaid_leave').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE90'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2405.38, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE90'), 2.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 20.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE90'), 15.2, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 152.0, places=2)

        payslip_results = {
            'BASIC': 2405.38,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2414.38,
            'ONSS': -315.56,
            'EmpBonus.1': 43.32,
            'ATN.CAR': 141.14,
            'GROSSIP': 2283.28,
            'IP.PART': -601.35,
            'GROSS': 1681.94,
            'P.P': -195.32,
            'P.P.DED': 14.36,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -20.97,
            'MEAL_V_EMP': -21.8,
            'REP.FEES': 136.15,
            'IP': 601.35,
            'IP.DED': -45.1,
            'NET': 2000.46,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_unpaid_half_days(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 15, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_unpaid_leave').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 16, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 16, 10, 0, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_unpaid_leave').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 4)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].amount, 57.94, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].amount, 0.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].amount, 0.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].amount, 2283.08, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_days, 1.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_days, 1.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_days, 2.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].number_of_days, 19.0, places=2)

        self.assertAlmostEqual(payslip.worked_days_line_ids[0].number_of_hours, 3.6, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[1].number_of_hours, 4.0, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[2].number_of_hours, 15.2, places=2)
        self.assertAlmostEqual(payslip.worked_days_line_ids[3].number_of_hours, 144.4, places=2)

        payslip_results = {
            'BASIC': 2341.02,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2350.02,
            'ONSS': -307.15,
            'EmpBonus.1': 76.38,
            'ATN.CAR': 141.14,
            'GROSSIP': 2260.4,
            'IP.PART': -585.26,
            'GROSS': 1675.14,
            'P.P': -188.9,
            'P.P.DED': 25.31,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -20.26,
            'MEAL_V_EMP': -21.8,
            'REP.FEES': 136.15,
            'IP': 585.26,
            'IP.DED': -43.89,
            'NET': 1996.87,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_unjustified_reason(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 14, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_unpredictable').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 25)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE250'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2527.69, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE250'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 21.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE250'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 159.6, places=2)

        payslip_results = {
            'BASIC': 2527.69,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2536.69,
            'ONSS': -331.55,
            'EmpBonus.1': 16.48,
            'ATN.CAR': 141.14,
            'GROSSIP': 2362.77,
            'IP.PART': -631.92,
            'GROSS': 1730.85,
            'P.P': -214.58,
            'P.P.DED': 5.46,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -22.31,
            'MEAL_V_EMP': -22.89,
            'REP.FEES': 143.08,
            'IP': 631.92,
            'IP.DED': -47.39,
            'NET': 2053.99,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_private_car(self):
        self.employee.km_home_work = 41
        self.contract.write({
            'wage': 3926.08,
            'holidays': 12.0,
            'transport_mode_car': False,
            'transport_mode_private_car': True,
            'fuel_card': 0.0,
            'internet': 43.99,
            'representation_fees': 150.0,
            'ip_wage_rate': 20.0,
            'car_id': False,
        })

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 1)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 22)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 3707.48, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 22.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 167.2, places=2)

        payslip_results = {
            'BASIC': 3707.48,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 3716.48,
            'ONSS': -485.74,
            'GROSSIP': 3230.74,
            'IP.PART': -741.5,
            'GROSS': 2489.24,
            'P.P': -579.04,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -35.29,
            'MEAL_V_EMP': -23.98,
            'CAR.PRIV': 69.5,
            'REP.FEES': 150.0,
            'IP': 741.5,
            'IP.DED': -55.61,
            'NET': 2747.31,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_sample_payslip_lines_edition(self):
        """
        Test the edtion of payslip lines in this sample payslip
        We want to edit the amount of the payslip line containing ATN.INT as code.
        After the edition, we recompute the following payslip lines and we check if the payslip line containing the ATN.INT.2 as code
        has been edited. It should be the opposite amount of the ATN.INT.
        We also want to edit hte amount of the payslip line containing ATN.MOB as code.
        Same process than the previous edition.
        After these both editions, we need to check if all payslip lines are correct and we have the expected total for the NET SALARY.
        """
        self.contract.ip = False
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 2, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 3, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 19)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSS': 2452.61,
            'P.P': -542.93,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -21.8,
            'REP.FEES': 150.0,
            'NET': 1864.08,
        }
        self._validate_payslip(payslip, payslip_results)

        # PAYSLIP EDITION
        action = payslip.action_edit_payslip_lines()
        wizard = self.env[action['res_model']].browse(action['res_id'])

        # Edit the amount of the payslip line with the ATN.INT code
        atn_int_line = wizard.line_ids.filtered(lambda line: line.code == 'ATN.INT')
        atn_int_line.amount = 6.0
        wizard.recompute_following_lines(atn_int_line.id)
        self.assertEqual(atn_int_line.amount, 6.0)
        self.assertAlmostEqual(atn_int_line.total, 6.0, places=2)

        # Check if the ATN.INT.2 has also been edited
        atn_int_2_line = wizard.line_ids.filtered(lambda line: line.code == 'ATN.INT.2')
        self.assertEqual(atn_int_2_line.amount, -atn_int_line.amount)
        self.assertAlmostEqual(atn_int_2_line.total, -6.0, places=2)

        # Edit the amount of the payslip line with the ATN.MOB code
        atn_mob_line = wizard.line_ids.filtered(lambda line: line.code == 'ATN.MOB')
        atn_mob_line.amount = 5.0
        wizard.recompute_following_lines(atn_mob_line.id)
        self.assertEqual(atn_mob_line.amount, 5.0)
        self.assertAlmostEqual(atn_mob_line.total, 5.0, places=2)

        # Check if the ATN.MOB.2
        atn_mob_2_line = wizard.line_ids.filtered(lambda line: line.code == 'ATN.MOB.2')
        self.assertEqual(atn_mob_2_line.amount, -5.0)
        self.assertAlmostEqual(atn_mob_2_line.total, -5.0, places=2)

        # Check if the payslip is correctly recomputed
        wizard.action_validate_edition()
        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 6.0,
            'ATN.MOB': 5.0,
            'SALARY': 2661.0,
            'ONSS': -347.79,
            'ATN.CAR': 141.14,
            'GROSS': 2454.35,
            'P.P': -542.93,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -6.0,
            'ATN.MOB.2': -5.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -21.8,
            'REP.FEES': 150.0,
            'NET': 1863.82,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_relapse_without_guaranteed_salary(self):
        # Sick 1 Week (1 - 7 september)
        # Back 1 week (8 - 14 september)
        # Sick 4 weeks (15 septembeer - 13 october)
        # Part time sick from the 31 calendar day since the first sick day

        sick_leave_1 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 1 Week',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 1),
            'request_date_to': datetime.date(2020, 9, 7),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 5,
        })
        sick_leave_1._compute_date_from_to()
        sick_leave_1 = self.env['hr.leave'].create(sick_leave_1._convert_to_write(sick_leave_1._cache))

        sick_leave_2 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 4 Weeks',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 15),
            'request_date_to': datetime.date(2020, 10, 13),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 24,
        })
        sick_leave_2._compute_date_from_to()
        sick_leave_2 = self.env['hr.leave'].create(sick_leave_2._convert_to_write(sick_leave_2._cache))

        (sick_leave_1 + sick_leave_2).action_validate()

        work_entries = self.employee.contract_id._generate_work_entries(datetime.date(2020, 9, 1), datetime.date(2020, 10, 31))

        attendance = self.env.ref('hr_work_entry.work_entry_type_attendance')
        sick_work_entry_type = self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave')
        partial_sick_work_entry_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_part_sick')

        work_entries_expected_results = {
            (1, 9): sick_work_entry_type,
            (2, 9): sick_work_entry_type,
            (3, 9): sick_work_entry_type,
            (4, 9): sick_work_entry_type,
            (7, 9): sick_work_entry_type,
            (8, 9): attendance,
            (9, 9): attendance,
            (10, 9): attendance,
            (11, 9): attendance,
            (14, 9): attendance,
            (15, 9): sick_work_entry_type,
            (16, 9): sick_work_entry_type,
            (17, 9): sick_work_entry_type,
            (18, 9): sick_work_entry_type,
            (20, 9): sick_work_entry_type,
            (21, 9): sick_work_entry_type,
            (22, 9): sick_work_entry_type,
            (23, 9): sick_work_entry_type,
            (24, 9): sick_work_entry_type,
            (25, 9): sick_work_entry_type,
            (28, 9): sick_work_entry_type,
            (29, 9): sick_work_entry_type,
            (30, 9): sick_work_entry_type,
            (1, 10): sick_work_entry_type,
            (2, 10): sick_work_entry_type,
            (5, 10): sick_work_entry_type,
            (6, 10): sick_work_entry_type,
            (7, 10): sick_work_entry_type,
            (8, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (12, 10): partial_sick_work_entry_type,
            (13, 10): partial_sick_work_entry_type,
            (14, 10): attendance,
            (15, 10): attendance,
            (16, 10): attendance,
            (19, 10): attendance,
            (20, 10): attendance,
            (21, 10): attendance,
            (22, 10): attendance,
            (23, 10): attendance,
            (26, 10): attendance,
            (27, 10): attendance,
            (28, 10): attendance,
            (29, 10): attendance,
            (30, 10): attendance,
            (31, 10): attendance,
        }

        for we in work_entries:
            self.assertEqual(we.work_entry_type_id, work_entries_expected_results.get((we.date_start.day, we.date_start.month)))

        september_payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(september_payslip.worked_days_line_ids), 2)
        self.assertEqual(len(september_payslip.input_line_ids), 0)
        self.assertEqual(len(september_payslip.line_ids), 23)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('WORK100'), 570.77, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE110'), 2079.23, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('WORK100'), 5.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE110'), 17.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('WORK100'), 38.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 129.2, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.61,
            'IP.PART': -662.5,
            'GROSS': 1790.11,
            'P.P': -240.26,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -5.45,
            'REP.FEES': 150.0,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2133.41,
        }
        self._validate_payslip(september_payslip, payslip_results)

        october_payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(october_payslip.worked_days_line_ids), 3)
        self.assertEqual(len(october_payslip.input_line_ids), 0)
        self.assertEqual(len(october_payslip.line_ids), 25)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('WORK100'), 1549.23, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE110'), 611.54, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE214'), 0.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('WORK100'), 13.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE110'), 5.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE214'), 4.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('WORK100'), 98.8, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 38.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE214'), 30.4, places=2)

        payslip_results = {
            'BASIC': 2160.77,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2169.77,
            'ONSS': -283.59,
            'EmpBonus.1': 96.99,
            'ATN.CAR': 141.14,
            'GROSSIP': 2124.31,
            'IP.PART': -540.19,
            'GROSS': 1584.12,
            'P.P': -150.38,
            'P.P.DED': 32.14,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -16.37,
            'MEAL_V_EMP': -14.17,
            'REP.FEES': 122.31,
            'IP': 540.19,
            'IP.DED': -40.51,
            'NET': 1907.18,
        }
        self._validate_payslip(october_payslip, payslip_results)

    def test_relapse_with_guaranteed_salary(self):
        # Sick 1 Week (1 - 2 september)
        # Back 1 week (3 - 18 september)
        # Sick 2.5 weeks (21 septembeer - 7 october)
        # No part time sick as there is at least 15 days between the 2 sick time offs

        sick_leave_1 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 2 Days',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 1),
            'request_date_to': datetime.date(2020, 9, 2),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 2,
        })
        sick_leave_1._compute_date_from_to()
        sick_leave_1 = self.env['hr.leave'].create(sick_leave_1._convert_to_write(sick_leave_1._cache))

        sick_leave_2 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 2.5 Weeks',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 21),
            'request_date_to': datetime.date(2020, 10, 7),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 13,
        })
        sick_leave_2._compute_date_from_to()
        sick_leave_2 = self.env['hr.leave'].create(sick_leave_2._convert_to_write(sick_leave_2._cache))

        (sick_leave_1 + sick_leave_2).action_validate()

        work_entries = self.employee.contract_id._generate_work_entries(datetime.date(2020, 9, 1), datetime.date(2020, 10, 31))

        attendance = self.env.ref('hr_work_entry.work_entry_type_attendance')
        sick_work_entry_type = self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave')

        work_entries_expected_results = {
            (1, 9): sick_work_entry_type,
            (2, 9): sick_work_entry_type,
            (3, 9): attendance,
            (4, 9): attendance,
            (7, 9): attendance,
            (8, 9): attendance,
            (9, 9): attendance,
            (10, 9): attendance,
            (11, 9): attendance,
            (14, 9): attendance,
            (15, 9): attendance,
            (16, 9): attendance,
            (17, 9): attendance,
            (18, 9): attendance,
            (20, 9): attendance,
            (21, 9): sick_work_entry_type,
            (22, 9): sick_work_entry_type,
            (23, 9): sick_work_entry_type,
            (24, 9): sick_work_entry_type,
            (25, 9): sick_work_entry_type,
            (28, 9): sick_work_entry_type,
            (29, 9): sick_work_entry_type,
            (30, 9): sick_work_entry_type,
            (1, 10): sick_work_entry_type,
            (2, 10): sick_work_entry_type,
            (5, 10): sick_work_entry_type,
            (6, 10): sick_work_entry_type,
            (7, 10): sick_work_entry_type,
            (8, 10): attendance,
            (9, 10): attendance,
            (9, 10): attendance,
            (12, 10): attendance,
            (13, 10): attendance,
            (14, 10): attendance,
            (15, 10): attendance,
            (16, 10): attendance,
            (19, 10): attendance,
            (20, 10): attendance,
            (21, 10): attendance,
            (22, 10): attendance,
            (23, 10): attendance,
            (26, 10): attendance,
            (27, 10): attendance,
            (28, 10): attendance,
            (29, 10): attendance,
            (30, 10): attendance,
            (31, 10): attendance,
        }

        for w in work_entries:
            self.assertEqual(w.work_entry_type_id, work_entries_expected_results.get((w.date_start.day, w.date_start.month)))

        september_payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(september_payslip.worked_days_line_ids), 2)
        self.assertEqual(len(september_payslip.input_line_ids), 0)
        self.assertEqual(len(september_payslip.line_ids), 23)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE110'), 1223.08, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('WORK100'), 1426.92, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE110'), 10.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('WORK100'), 12.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 76.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('WORK100'), 91.2, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.61,
            'IP.PART': -662.5,
            'GROSS': 1790.11,
            'P.P': -240.26,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -13.08,
            'REP.FEES': 150.0,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2125.78,
        }
        self._validate_payslip(september_payslip, payslip_results)

        october_payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(october_payslip.worked_days_line_ids), 2)
        self.assertEqual(len(october_payslip.input_line_ids), 0)
        self.assertEqual(len(october_payslip.line_ids), 23)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE110'), 611.54, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('WORK100'), 2038.46, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE110'), 5.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('WORK100'), 17.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 38.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('WORK100'), 129.2, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.61,
            'IP.PART': -662.5,
            'GROSS': 1790.11,
            'P.P': -240.26,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -18.53,
            'REP.FEES': 150.0,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2120.33,
        }
        self._validate_payslip(october_payslip, payslip_results)

    def test_sick_more_than_30_days(self):
        # Sick 1 september - 15 october
        # Part time sick from the 31th day
        sick_leave = self.env['hr.leave'].new({
            'name': 'Sick Time Off 33 Days',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 1),
            'request_date_to': datetime.date(2020, 10, 15),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 33,
        })
        sick_leave._compute_date_from_to()
        sick_leave = self.env['hr.leave'].create(sick_leave._convert_to_write(sick_leave._cache))
        sick_leave.action_validate()

        work_entries = self.employee.contract_id._generate_work_entries(datetime.date(2020, 9, 1), datetime.date(2020, 10, 31))

        attendance = self.env.ref('hr_work_entry.work_entry_type_attendance')
        sick_work_entry_type = self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave')
        partial_sick_work_entry_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_part_sick')

        work_entries_expected_results = {
            (1, 9): sick_work_entry_type,
            (2, 9): sick_work_entry_type,
            (3, 9): sick_work_entry_type,
            (4, 9): sick_work_entry_type,
            (7, 9): sick_work_entry_type,
            (8, 9): sick_work_entry_type,
            (9, 9): sick_work_entry_type,
            (10, 9): sick_work_entry_type,
            (11, 9): sick_work_entry_type,
            (14, 9): sick_work_entry_type,
            (15, 9): sick_work_entry_type,
            (16, 9): sick_work_entry_type,
            (17, 9): sick_work_entry_type,
            (18, 9): sick_work_entry_type,
            (20, 9): sick_work_entry_type,
            (21, 9): sick_work_entry_type,
            (22, 9): sick_work_entry_type,
            (23, 9): sick_work_entry_type,
            (24, 9): sick_work_entry_type,
            (25, 9): sick_work_entry_type,
            (28, 9): sick_work_entry_type,
            (29, 9): sick_work_entry_type,
            (30, 9): sick_work_entry_type,
            (1, 10): partial_sick_work_entry_type,
            (2, 10): partial_sick_work_entry_type,
            (5, 10): partial_sick_work_entry_type,
            (6, 10): partial_sick_work_entry_type,
            (7, 10): partial_sick_work_entry_type,
            (8, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (12, 10): partial_sick_work_entry_type,
            (13, 10): partial_sick_work_entry_type,
            (14, 10): partial_sick_work_entry_type,
            (15, 10): partial_sick_work_entry_type,
            (16, 10): attendance,
            (19, 10): attendance,
            (20, 10): attendance,
            (21, 10): attendance,
            (22, 10): attendance,
            (23, 10): attendance,
            (26, 10): attendance,
            (27, 10): attendance,
            (28, 10): attendance,
            (29, 10): attendance,
            (30, 10): attendance,
            (31, 10): attendance,
        }

        for w in work_entries:
            self.assertEqual(w.work_entry_type_id, work_entries_expected_results.get((w.date_start.day, w.date_start.month)))

        september_payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(september_payslip.worked_days_line_ids), 1)
        self.assertEqual(len(september_payslip.input_line_ids), 0)
        self.assertEqual(len(september_payslip.line_ids), 23)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE110'), 2650.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE110'), 22.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 167.2, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.61,
            'IP.PART': -662.5,
            'GROSS': 1790.11,
            'P.P': -240.26,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': 0.0,
            'REP.FEES': 150.0,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2138.86,
        }
        self._validate_payslip(september_payslip, payslip_results)

        october_payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(october_payslip.worked_days_line_ids), 2)
        self.assertEqual(len(october_payslip.input_line_ids), 0)
        self.assertEqual(len(october_payslip.line_ids), 25)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('WORK100'), 1304.62, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE214'), 0.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('WORK100'), 11.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE214'), 11.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('WORK100'), 83.6, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE214'), 83.6, places=2)

        payslip_results = {
            'BASIC': 1304.62,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1313.62,
            'ONSS': -171.69,
            'EmpBonus.1': 171.69,
            'ATN.CAR': 141.14,
            'GROSSIP': 1454.76,
            'IP.PART': -326.16,
            'GROSS': 1128.61,
            'P.P': -35.89,
            'P.P.DED': 35.89,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -11.99,
            'REP.FEES': 73.85,
            'IP': 326.16,
            'IP.DED': -24.46,
            'NET': 1342.01,
        }
        self._validate_payslip(october_payslip, payslip_results)

    def test_relapse_without_guaranteed_salary_credit_time(self):
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 1, 1),
            'date_end': datetime.date(2021, 9, 30),
            'wage': 2120.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        sick_leave_1 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 1 Week',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 1),
            'request_date_to': datetime.date(2020, 9, 7),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 5,
        })
        sick_leave_1._compute_date_from_to()
        sick_leave_1 = self.env['hr.leave'].create(sick_leave_1._convert_to_write(sick_leave_1._cache))

        sick_leave_2 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 4 Weeks',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 15),
            'request_date_to': datetime.date(2020, 10, 13),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 24,
        })
        sick_leave_2._compute_date_from_to()
        sick_leave_2 = self.env['hr.leave'].create(sick_leave_2._convert_to_write(sick_leave_2._cache))

        (sick_leave_1 + sick_leave_2).action_validate()

        work_entries = self.employee.contract_id._generate_work_entries(datetime.date(2020, 9, 1), datetime.date(2020, 10, 31))

        attendance = self.env.ref('hr_work_entry.work_entry_type_attendance')
        sick_work_entry_type = self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave')
        partial_sick_work_entry_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_part_sick')
        credit_time_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_credit_time')

        work_entries_expected_results = {
            (1, 9): sick_work_entry_type,
            (2, 9): credit_time_type,
            (3, 9): sick_work_entry_type,
            (4, 9): sick_work_entry_type,
            (7, 9): sick_work_entry_type,
            (8, 9): attendance,
            (9, 9): credit_time_type,
            (10, 9): attendance,
            (11, 9): attendance,
            (14, 9): attendance,
            (15, 9): sick_work_entry_type,
            (16, 9): credit_time_type,
            (17, 9): sick_work_entry_type,
            (18, 9): sick_work_entry_type,
            (20, 9): sick_work_entry_type,
            (21, 9): sick_work_entry_type,
            (22, 9): sick_work_entry_type,
            (23, 9): credit_time_type,
            (24, 9): sick_work_entry_type,
            (25, 9): sick_work_entry_type,
            (28, 9): sick_work_entry_type,
            (29, 9): sick_work_entry_type,
            (30, 9): credit_time_type,
            (1, 10): sick_work_entry_type,
            (2, 10): sick_work_entry_type,
            (5, 10): sick_work_entry_type,
            (6, 10): sick_work_entry_type,
            (7, 10): credit_time_type,
            (8, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (12, 10): partial_sick_work_entry_type,
            (13, 10): partial_sick_work_entry_type,
            (14, 10): credit_time_type,
            (15, 10): attendance,
            (16, 10): attendance,
            (19, 10): attendance,
            (20, 10): attendance,
            (21, 10): credit_time_type,
            (22, 10): attendance,
            (23, 10): attendance,
            (26, 10): attendance,
            (27, 10): attendance,
            (28, 10): credit_time_type,
            (29, 10): attendance,
            (30, 10): attendance,
            (31, 10): attendance,
        }

        for we in work_entries:
            self.assertEqual(we.work_entry_type_id, work_entries_expected_results.get((we.date_start.day, we.date_start.month)))
        work_entries.action_validate()

        september_payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(september_payslip.worked_days_line_ids), 3)
        self.assertEqual(len(september_payslip.input_line_ids), 0)
        self.assertEqual(len(september_payslip.line_ids), 25)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('WORK100'), 530.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE110'), 1590.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('WORK100'), 4.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE110'), 13.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE300'), 5.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('WORK100'), 30.4, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 98.8, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE300'), 38.0, places=2)

        payslip_results = {
            'BASIC': 2120.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2129.0,
            'ONSS': -278.26,
            'EmpBonus.1': 105.93,
            'ATN.CAR': 141.14,
            'GROSSIP': 2097.81,
            'IP.PART': -530.0,
            'GROSS': 1567.81,
            'P.P': -143.96,
            'P.P.DED': 35.11,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -13.27,
            'MEAL_V_EMP': -4.36,
            'REP.FEES': 106.73,
            'IP': 530.0,
            'IP.DED': -39.75,
            'NET': 1888.17,
        }
        self._validate_payslip(september_payslip, payslip_results)

        october_payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(october_payslip.worked_days_line_ids), 4)
        self.assertEqual(len(october_payslip.input_line_ids), 0)
        self.assertEqual(len(october_payslip.line_ids), 25)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE110'), 489.23, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE214'), 0.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('WORK100'), 1141.54, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE300'), 4.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE110'), 4.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE214'), 4.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('WORK100'), 10.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE300'), 30.4, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 30.4, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE214'), 30.4, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('WORK100'), 76.0, places=2)

        payslip_results = {
            'BASIC': 1630.77,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1639.77,
            'ONSS': -214.32,
            'EmpBonus.1': 205.65,
            'ATN.CAR': 141.14,
            'GROSSIP': 1772.24,
            'IP.PART': -407.69,
            'GROSS': 1364.55,
            'P.P': -78.02,
            'P.P.DED': 68.15,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -10.9,
            'REP.FEES': 80.77,
            'IP': 407.69,
            'IP.DED': -30.58,
            'NET': 1651.53,
        }
        self._validate_payslip(october_payslip, payslip_results)

    def test_relapse_with_guaranteed_salary_credit_time(self):
        # Sick 2 days (1 - 2 september)
        # Back 1 week (3 - 18 september)
        # Sick 2.5 weeks (21 septembeer - 7 october)
        # No part time sick as there is at least 15 days between the 2 sick time offs
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 1, 1),
            'date_end': datetime.date(2021, 9, 30),
            'wage': 2120.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        sick_leave_1 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 2 Days',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 1),
            'request_date_to': datetime.date(2020, 9, 2),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 2,
        })
        sick_leave_1._compute_date_from_to()
        sick_leave_1 = self.env['hr.leave'].create(sick_leave_1._convert_to_write(sick_leave_1._cache))

        sick_leave_2 = self.env['hr.leave'].new({
            'name': 'Sick Time Off 2.5 Weeks',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 21),
            'request_date_to': datetime.date(2020, 10, 7),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 13,
        })
        sick_leave_2._compute_date_from_to()
        sick_leave_2 = self.env['hr.leave'].create(sick_leave_2._convert_to_write(sick_leave_2._cache))

        (sick_leave_1 + sick_leave_2).action_validate()

        work_entries = self.employee.contract_id._generate_work_entries(datetime.date(2020, 9, 1), datetime.date(2020, 10, 31))

        attendance = self.env.ref('hr_work_entry.work_entry_type_attendance')
        sick_work_entry_type = self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave')
        credit_time_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_credit_time')

        work_entries_expected_results = {
            (1, 9): sick_work_entry_type,
            (2, 9): credit_time_type,
            (3, 9): attendance,
            (4, 9): attendance,
            (7, 9): attendance,
            (8, 9): attendance,
            (9, 9): credit_time_type,
            (10, 9): attendance,
            (11, 9): attendance,
            (14, 9): attendance,
            (15, 9): attendance,
            (16, 9): credit_time_type,
            (17, 9): attendance,
            (18, 9): attendance,
            (20, 9): attendance,
            (21, 9): sick_work_entry_type,
            (22, 9): sick_work_entry_type,
            (23, 9): credit_time_type,
            (24, 9): sick_work_entry_type,
            (25, 9): sick_work_entry_type,
            (28, 9): sick_work_entry_type,
            (29, 9): sick_work_entry_type,
            (30, 9): credit_time_type,
            (1, 10): sick_work_entry_type,
            (2, 10): sick_work_entry_type,
            (5, 10): sick_work_entry_type,
            (6, 10): sick_work_entry_type,
            (7, 10): credit_time_type,
            (8, 10): attendance,
            (9, 10): attendance,
            (9, 10): attendance,
            (12, 10): attendance,
            (13, 10): attendance,
            (14, 10): credit_time_type,
            (15, 10): attendance,
            (16, 10): attendance,
            (19, 10): attendance,
            (20, 10): attendance,
            (21, 10): credit_time_type,
            (22, 10): attendance,
            (23, 10): attendance,
            (26, 10): attendance,
            (27, 10): attendance,
            (28, 10): credit_time_type,
            (29, 10): attendance,
            (30, 10): attendance,
            (31, 10): attendance,
        }

        for w in work_entries:
            self.assertEqual(w.work_entry_type_id, work_entries_expected_results.get((w.date_start.day, w.date_start.month)))
        work_entries.action_validate()

        september_payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(september_payslip.worked_days_line_ids), 3)
        self.assertEqual(len(september_payslip.input_line_ids), 0)
        self.assertEqual(len(september_payslip.line_ids), 25)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('WORK100'), 1263.85, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE110'), 856.15, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE300'), 5.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('WORK100'), 10.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE110'), 7.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE300'), 38.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('WORK100'), 76.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 53.2, places=2)

        payslip_results = {
            'BASIC': 2120.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2129.0,
            'ONSS': -278.26,
            'EmpBonus.1': 105.93,
            'ATN.CAR': 141.14,
            'GROSSIP': 2097.81,
            'IP.PART': -530.0,
            'GROSS': 1567.81,
            'P.P': -143.96,
            'P.P.DED': 35.11,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -13.27,
            'MEAL_V_EMP': -10.9,
            'REP.FEES': 106.73,
            'IP': 530.0,
            'IP.DED': -39.75,
            'NET': 1881.63,
        }
        self._validate_payslip(september_payslip, payslip_results)

        october_payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(october_payslip.worked_days_line_ids), 3)
        self.assertEqual(len(october_payslip.input_line_ids), 0)
        self.assertEqual(len(october_payslip.line_ids), 25)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE110'), 489.23, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('WORK100'), 1630.77, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE300'), 4.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE110'), 4.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('WORK100'), 14.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE300'), 30.4, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 30.4, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('WORK100'), 106.4, places=2)

        payslip_results = {
            'BASIC': 2120.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2129.0,
            'ONSS': -278.26,
            'EmpBonus.1': 105.93,
            'ATN.CAR': 141.14,
            'GROSSIP': 2097.81,
            'IP.PART': -530.0,
            'GROSS': 1567.81,
            'P.P': -143.96,
            'P.P.DED': 35.11,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -13.27,
            'MEAL_V_EMP': -15.26,
            'REP.FEES': 115.38,
            'IP': 530.0,
            'IP.DED': -39.75,
            'NET': 1885.92,
        }
        self._validate_payslip(october_payslip, payslip_results)

    def test_sick_more_than_30_days_credit_time(self):
        # Sick 1 september - 15 october
        # Part time sick from the 31th day
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 1, 1),
            'date_end': datetime.date(2021, 9, 30),
            'wage': 2120.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        sick_leave = self.env['hr.leave'].new({
            'name': 'Sick Time Off 33 Days',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 9, 1),
            'request_date_to': datetime.date(2020, 10, 15),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 33,
        })
        sick_leave._compute_date_from_to()
        sick_leave = self.env['hr.leave'].create(sick_leave._convert_to_write(sick_leave._cache))
        sick_leave.action_validate()

        work_entries = self.employee.contract_id._generate_work_entries(datetime.date(2020, 9, 1), datetime.date(2020, 10, 31))

        attendance = self.env.ref('hr_work_entry.work_entry_type_attendance')
        sick_work_entry_type = self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave')
        partial_sick_work_entry_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_part_sick')
        credit_time_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_credit_time')

        work_entries_expected_results = {
            (1, 9): sick_work_entry_type,
            (2, 9): credit_time_type,
            (3, 9): sick_work_entry_type,
            (4, 9): sick_work_entry_type,
            (7, 9): sick_work_entry_type,
            (8, 9): sick_work_entry_type,
            (9, 9): credit_time_type,
            (10, 9): sick_work_entry_type,
            (11, 9): sick_work_entry_type,
            (14, 9): sick_work_entry_type,
            (15, 9): sick_work_entry_type,
            (16, 9): credit_time_type,
            (17, 9): sick_work_entry_type,
            (18, 9): sick_work_entry_type,
            (20, 9): sick_work_entry_type,
            (21, 9): sick_work_entry_type,
            (22, 9): sick_work_entry_type,
            (23, 9): credit_time_type,
            (24, 9): sick_work_entry_type,
            (25, 9): sick_work_entry_type,
            (28, 9): sick_work_entry_type,
            (29, 9): sick_work_entry_type,
            (30, 9): credit_time_type,
            (1, 10): partial_sick_work_entry_type,
            (2, 10): partial_sick_work_entry_type,
            (5, 10): partial_sick_work_entry_type,
            (6, 10): partial_sick_work_entry_type,
            (7, 10): credit_time_type,
            (8, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (9, 10): partial_sick_work_entry_type,
            (12, 10): partial_sick_work_entry_type,
            (13, 10): partial_sick_work_entry_type,
            (14, 10): credit_time_type,
            (15, 10): partial_sick_work_entry_type,
            (16, 10): attendance,
            (19, 10): attendance,
            (20, 10): attendance,
            (21, 10): credit_time_type,
            (22, 10): attendance,
            (23, 10): attendance,
            (26, 10): attendance,
            (27, 10): attendance,
            (28, 10): credit_time_type,
            (29, 10): attendance,
            (30, 10): attendance,
            (31, 10): attendance,
        }

        for we in work_entries:
            self.assertEqual(we.work_entry_type_id, work_entries_expected_results.get((we.date_start.day, we.date_start.month)))

        september_payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(september_payslip.worked_days_line_ids), 2)
        self.assertEqual(len(september_payslip.input_line_ids), 0)
        self.assertEqual(len(september_payslip.line_ids), 25)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_amount('LEAVE110'), 2120.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE300'), 5.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_days('LEAVE110'), 17.0, places=2)

        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE300'), 38.0, places=2)
        self.assertAlmostEqual(september_payslip._get_worked_days_line_number_of_hours('LEAVE110'), 129.2, places=2)

        payslip_results = {
            'BASIC': 2120.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2129.0,
            'ONSS': -278.26,
            'EmpBonus.1': 105.93,
            'ATN.CAR': 141.14,
            'GROSSIP': 2097.81,
            'IP.PART': -530.0,
            'GROSS': 1567.81,
            'P.P': -143.96,
            'P.P.DED': 35.11,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -13.27,
            'MEAL_V_EMP': 0.0,
            'REP.FEES': 106.73,
            'IP': 530.0,
            'IP.DED': -39.75,
            'NET': 1892.53,
        }
        self._validate_payslip(september_payslip, payslip_results)

        october_payslip = self._generate_payslip(datetime.date(2020, 10, 1), datetime.date(2020, 10, 31))

        self.assertEqual(len(october_payslip.worked_days_line_ids), 3)
        self.assertEqual(len(october_payslip.input_line_ids), 0)
        self.assertEqual(len(october_payslip.line_ids), 25)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('LEAVE214'), 0.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_amount('WORK100'), 1019.23, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE300'), 4.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('LEAVE214'), 9.0, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_days('WORK100'), 9.0, places=2)

        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE300'), 30.4, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('LEAVE214'), 68.4, places=2)
        self.assertAlmostEqual(october_payslip._get_worked_days_line_number_of_hours('WORK100'), 68.4, places=2)

        payslip_results = {
            'BASIC': 1019.23,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 1028.23,
            'ONSS': -134.39,
            'EmpBonus.1': 134.39,
            'ATN.CAR': 141.14,
            'GROSSIP': 1169.37,
            'IP.PART': -254.81,
            'GROSS': 914.57,
            'P.P': 0.0,
            'P.P.DED': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': -9.81,
            'REP.FEES': 37.5,
            'IP': 254.81,
            'IP.DED': -19.11,
            'NET': 1027.81,
        }
        self._validate_payslip(october_payslip, payslip_results)

    def test_small_unemployment(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 14, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_small_unemployment').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 23)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE205'), 122.31, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2527.69, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE205'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 21.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE205'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 159.6, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.61,
            'IP.PART': -662.5,
            'GROSS': 1790.11,
            'P.P': -240.26,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -22.89,
            'REP.FEES': 143.08,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2109.05,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_small_unemployment_1_week(self):
        self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 14, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 18, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_small_unemployment').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 9, 21, 6, 0, 0),
            'date_to': datetime.datetime(2020, 9, 22, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_small_unemployment').id
        }])

        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 2)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 23)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE205'), 856.15, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 1793.85, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE205'), 7.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 15.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE205'), 53.2, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 114.0, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.61,
            'IP.PART': -662.5,
            'GROSS': 1790.11,
            'P.P': -240.26,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -16.35,
            'REP.FEES': 101.54,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2074.05,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_full_time_credit_time_atn_negative_net(self):
        self.contract.write({
            'resource_calendar_id': self.resource_calendar_0_hours_per_week.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 8, 1),
            'date_end': datetime.date(2020, 11, 30),
            'wage': 0.0,
            'time_credit': True,
            'work_time_rate': "0",
        })
        payslip = self._generate_payslip(datetime.date(2020, 9, 1), datetime.date(2020, 9, 30))

        self.assertEqual(len(payslip.worked_days_line_ids), 1)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 23)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 22.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 167.2, places=2)

        payslip_results = {
            'BASIC': 0.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 9.0,
            'ONSS': -1.18,
            'EmpBonus.1': 0.0,
            'ATN.CAR': 141.14,
            'GROSSIP': 148.97,
            'IP.PART': 0.0,
            'GROSS': 148.97,
            'P.P': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': 0.0,
            'REP.FEES': 0.0,
            'IP': 0.0,
            'IP.DED': 0.0,
            'NET': -1.18,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_training_time_off_above_threshold(self):
        self.leaves = self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'company_id': self.env.company.id,
            'date_from': datetime.datetime(2020, 5, 4, 5, 0, 0),
            'date_to': datetime.datetime(2020, 5, 4, 16, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'company_id': self.env.company.id,
            'date_from': datetime.datetime(2020, 5, 5, 5, 0, 0),
            'date_to': datetime.datetime(2020, 5, 5, 16, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 5, 6, 6, 0, 0),
            'date_to': datetime.datetime(2020, 5, 6, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_training_time_off').id
        }])

        self.car.write({
            'first_contract_date': datetime.date(2014, 6, 10),
            'co2': 98.0,
            'car_value': 25686.82,
            'acquisition_date': datetime.date(2014, 6, 10)
        })

        self.vehicle_contract.write({
            'name': "Test Contract",
            'vehicle_id': self.car.id,
            'company_id': self.env.company.id,
            'start_date': datetime.date(2020, 11, 30),
            'expiration_date': datetime.date(2021, 11, 30),
            'state': "open",
            'cost_generated': 0.0,
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 405.315
        })

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 4, 1),
            'date_end': datetime.date(2020, 11, 30),
            'wage': 3608.66,
            'fuel_card': 200.0,
            'mobile': 0.0,
            'ip': True,
            'ip_wage_rate': 25.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        payslip = self._generate_payslip(datetime.date(2020, 5, 1), datetime.date(2020, 5, 31))

        self.assertEqual(len(payslip.worked_days_line_ids), 4)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE500'), 416.38, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2984.08, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE260'), 135.14, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE500'), 2.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 14.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 4.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE260'), 1.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE500'), 15.2, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 106.4, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 30.4, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE260'), 7.6, places=2)

        payslip_results = {
            'BASIC': 3535.6,
            'ATN.INT': 5.0,
            'SALARY': 3540.6,
            'ONSS': -462.76,
            'ATN.CAR': 109.17,
            'GROSSIP': 3187.01,
            'IP.PART': -883.9,
            'GROSS': 2303.11,
            'P.P': -470.71,
            'ATN.CAR.2': -109.17,
            'ATN.INT.2': -5.0,
            'M.ONSS': -33.4,
            'MEAL_V_EMP': -15.26,
            'REP.FEES': 106.73,
            'IP': 883.9,
            'IP.DED': -66.29,
            'NET': 2593.91,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_training_time_off_below_threshold(self):
        self.leaves = self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'company_id': self.env.company.id,
            'date_from': datetime.datetime(2020, 5, 4, 5, 0, 0),
            'date_to': datetime.datetime(2020, 5, 4, 16, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'company_id': self.env.company.id,
            'date_from': datetime.datetime(2020, 5, 5, 5, 0, 0),
            'date_to': datetime.datetime(2020, 5, 5, 16, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }, {
            'name': "Absence",
            'calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'company_id': self.env.company.id,
            'resource_id': self.employee.resource_id.id,
            'date_from': datetime.datetime(2020, 5, 6, 6, 0, 0),
            'date_to': datetime.datetime(2020, 5, 6, 14, 36, 0),
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_training_time_off').id
        }])

        self.car.write({
            'first_contract_date': datetime.date(2014, 6, 10),
            'co2': 98.0,
            'car_value': 25686.82,
            'acquisition_date': datetime.date(2014, 6, 10)
        })

        self.vehicle_contract.write({
            'name': "Test Contract",
            'vehicle_id': self.car.id,
            'company_id': self.env.company.id,
            'start_date': datetime.date(2020, 11, 30),
            'expiration_date': datetime.date(2021, 11, 30),
            'state': "open",
            'cost_generated': 0.0,
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 405.315
        })

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_thurday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'date_start': datetime.date(2020, 4, 1),
            'date_end': datetime.date(2020, 11, 30),
            'wage': 2650,
            'fuel_card': 200.0,
            'mobile': 0.0,
            'ip': True,
            'ip_wage_rate': 25.0,
            'time_credit': True,
            'work_time_rate': "0.8",
        })

        payslip = self._generate_payslip(datetime.date(2020, 5, 1), datetime.date(2020, 5, 31))

        self.assertEqual(len(payslip.worked_days_line_ids), 4)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 21)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE260'), 152.88, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE500'), 305.77, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('WORK100'), 2191.35, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE300'), 0.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE260'), 1.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE500'), 2.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('WORK100'), 14.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE300'), 4.0, places=2)

        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE260'), 7.6, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE500'), 15.2, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('WORK100'), 106.4, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE300'), 30.4, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'SALARY': 2655.0,
            'ONSS': -347.01,
            'ATN.CAR': 109.17,
            'GROSSIP': 2417.16,
            'IP.PART': -662.5,
            'GROSS': 1754.66,
            'P.P': -221.0,
            'ATN.CAR.2': -109.17,
            'ATN.INT.2': -5.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -15.26,
            'REP.FEES': 106.73,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2100.12,
        }
        self._validate_payslip(payslip, payslip_results)

    def test_credit_time_keep_old_time_off(self):
        # Test Case: When setting a credit time, we change the calendar
        # and thus it could be possible to loose the time off that were planned
        # and validated before the contract change.
        # Ensure that the time off are not lost.

        sick_time_off = self.env['hr.leave'].new({
            'name': 'Maternity Time Off : 15 weeks',
            'employee_id': self.employee.id,
            'holiday_status_id': self.sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 11, 9),
            'request_date_to': datetime.date(2020, 11, 10),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 2,
        })
        sick_time_off._compute_date_from_to()
        sick_time_off = self.env['hr.leave'].create(sick_time_off._convert_to_write(sick_time_off._cache))
        sick_time_off.action_validate()

        self.contract.write({
            'resource_calendar_id': self.resource_calendar_4_5_wednesday_off.id,
            'standard_calendar_id': self.resource_calendar_38_hours_per_week,
            'time_credit': True,
            'work_time_rate': "0.8",
            'wage': 2120.0,
            'date_start': datetime.date(2020, 9, 16),
            'date_end': datetime.date(2020, 12, 31),
        })

        work_entries = self.contract._generate_work_entries(datetime.date(2020, 11, 1), datetime.date(2020, 11, 30))
        sick_work_entries = work_entries.filtered(lambda we: we.work_entry_type_id == self.sick_time_off_type.work_entry_type_id)
        self.assertEqual(len(sick_work_entries), 4)

    def test_accounting_entries(self):
        # Test case: Create 2 payslips (1 classic / 1 low salary)
        # Generate and validate the accounting entries

        # 1rst contract
        self.contract.write({
            'transport_mode_private_car': True,
            'date_generated_from': datetime.datetime(2020, 12, 1, 0, 0, 0),
            'date_generated_to': datetime.datetime(2020, 12, 1, 0, 0, 0),
        })

        # Second contract
        second_employee = self.env['hr.employee'].create([{
            'name': "Test Employee",
            'address_home_id': self.address_home.id,
            'resource_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'marital': "single",
            'km_home_work': 75,
        }])

        second_car = self.env['fleet.vehicle'].create([{
            'name': "Test Car 2",
            'license_plate': "TEST2",
            'driver_id': second_employee.address_home_id.id,
            'company_id': self.env.company.id,
            'model_id': self.model.id,
            'first_contract_date': datetime.date(2020, 12, 17),
            'co2': 88.0,
            'car_value': 38000.0,
            'fuel_type': "diesel",
            'acquisition_date': datetime.date(2020, 1, 1)
        }])

        second_vehicle_contract = self.env['fleet.vehicle.log.contract'].create({
            'name': "Test Contract",
            'vehicle_id': second_car.id,
            'company_id': self.env.company.id,
            'start_date': datetime.date(2020, 12, 17),
            'expiration_date': datetime.date(2021, 12, 17),
            'state': "open",
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 450.0
        })

        second_contract = self.env['hr.contract'].create([{
            'name': "Contract For Payslip Test",
            'employee_id': second_employee.id,
            'resource_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'date_generated_from': datetime.datetime(2020, 12, 1, 0, 0, 0),
            'date_generated_to': datetime.datetime(2020, 12, 1, 0, 0, 0),
            'car_id': second_car.id,
            'structure_type_id': self.env.ref('hr_contract.structure_type_employee_cp200').id,
            'date_start': datetime.date(2018, 12, 31),
            'wage': 2000.0,
            'state': "open",
            'transport_mode_car': True,
            'transport_mode_private_car': True,
            'fuel_card': 150.0,
            'internet': 38.0,
            'representation_fees': 150.0,
            'mobile': 30.0,
            'meal_voucher_amount': 7.45,
            'eco_checks': 250.0,
            'ip_wage_rate': 25.0,
            'ip': True,
        }])

        # Generate Batch / payslips
        work_entries = self.contract._generate_work_entries(datetime.date(2020, 12, 1), datetime.date(2020, 12, 31))
        payslip_run_id = self.env['hr.payslip.employees'].with_context(
            default_date_start='2020-12-01',
            default_date_end='2020-12-31',
            allowed_company_ids=self.env.company.ids,
        ).create({}).compute_sheet()['res_id']
        payslip_run = self.env['hr.payslip.run'].browse(payslip_run_id)

        payslips = payslip_run.slip_ids
        self.assertEqual(len(payslips), 2)

        payslip_1 = payslips.filtered(lambda p: p.employee_id == self.employee)
        self.assertEqual(len(payslip_1.worked_days_line_ids), 1)
        self.assertEqual(len(payslip_1.input_line_ids), 0)
        self.assertEqual(len(payslip_1.line_ids), 24)

        self.assertAlmostEqual(payslip_1._get_worked_days_line_amount('WORK100'), 2650.0, places=2)
        self.assertAlmostEqual(payslip_1._get_worked_days_line_number_of_days('WORK100'), 23.0, places=2)
        self.assertAlmostEqual(payslip_1._get_worked_days_line_number_of_hours('WORK100'), 174.8, places=2)

        payslip_results = {
            'BASIC': 2650.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2659.0,
            'ONSS': -347.53,
            'ONSSTOTAL': 347.53,
            'ATN.CAR': 141.14,
            'GROSSIP': 2452.61,
            'IP.PART': -662.5,
            'GROSS': 1790.11,
            'P.P': -265.94,
            'PPTOTAL': 265.94,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -23.66,
            'MEAL_V_EMP': -25.07,
            'CAR.PRIV': 98.5,
            'REP.FEES': 150.0,
            'IP': 662.5,
            'IP.DED': -49.69,
            'NET': 2186.61,
            'REMUNERATION': 1987.5,
            'ONSSEMPLOYER': 721.65,
        }
        self._validate_payslip(payslip_1, payslip_results)
        # ================================================ #
        #         Accounting entries for slip 1            #
        # ================================================ #
        # Basic salary 2650

        # Account   Formula                                                     Debit       Credit
        # 620200    Remuneration: Basic_Salary - IP                            1987.5
        # 453000    Withholding Taxes  Precompte - low salary bonus                         265.94

        # 643000    IP                                                          662.5
        # 453000    IP Deduction                                                             43.17

        # 454000    ONSS worker - Employment Bonus                                          347.53
        # 454000    ONSS Misceleneous                                                        23.66

        # 620200    Private Car                                                  98.5
        # 620200    Frais de rep                                                  150

        # 455000    Meal vouchers retenue                                                    25.07
        # 455000    Remunration dues = NET                                                 2193.13

        # 454000    ONSS Employer                                                           721.65
        # 621000    ONSS Employer                                              721.65
        # ----------------------------------------------------------------------------------------
        # BALANCE                                                             3620.15      3620.15

        payslip_2 = payslips.filtered(lambda p: p.employee_id == second_employee)

        self.assertEqual(len(payslip_2.worked_days_line_ids), 1)
        self.assertEqual(len(payslip_2.input_line_ids), 0)
        self.assertEqual(len(payslip_2.line_ids), 26)

        self.assertAlmostEqual(payslip_2._get_worked_days_line_amount('WORK100'), 2000.0, places=2)
        self.assertAlmostEqual(payslip_2._get_worked_days_line_number_of_days('WORK100'), 23.0, places=2)
        self.assertAlmostEqual(payslip_2._get_worked_days_line_number_of_hours('WORK100'), 174.8, places=2)

        payslip_results = {
            'BASIC': 2000.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 2009.0,
            'ONSS': -262.58,
            'EmpBonus.1': 132.26,
            'ONSSTOTAL': 130.32,
            'ATN.CAR': 141.14,
            'GROSSIP': 2019.83,
            'IP.PART': -500.0,
            'GROSS': 1519.83,
            'P.P': -150.38,
            'P.P.DED': 43.83,
            'PPTOTAL': 106.55,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': -4.15,
            'MEAL_V_EMP': -25.07,
            'CAR.PRIV': 98.5,
            'REP.FEES': 150.0,
            'IP': 500.0,
            'IP.DED': -37.5,
            'NET': 1944.91,
            'REMUNERATION': 1500.0,
            'ONSSEMPLOYER': 545.24,
        }
        self._validate_payslip(payslip_2, payslip_results)
        # ================================================ #
        #         Accounting entries for slip 2            #
        # ================================================ #
        # Basic salary 2000

        # Account   Formula                                                     Debit       Credit
        # 620200    Remuneration: Basic_Salary - IP                              1500
        # 453000    Withholding Taxes  Precompte - low salary bonus                         106.55

        # 643000    IP                                                            500
        # 453000    IP Deduction                                                             32.58

        # 454000    ONSS worker - Employment Bonus                                          130.32
        # 454000    ONSS Misceleneous                                                         4.15

        # 620200    Private Car                                                  98.5
        # 620200    Frais de rep                                                  150

        # 455000    Meal vouchers retenue                                                    25.07
        # 455000    Remunration dues = NET                                                 1949.83

        # 454000    ONSS Employer                                                           545.24
        # 621000    ONSS Employer                                              545.24
        # ----------------------------------------------------------------------------------------
        # BALANCE                                                             2793.74      2793.74

        # Generate accounting entries
        payslip_run.action_validate()
        account_move = payslip_1.move_id
        move_lines = account_move.line_ids

        balance = 6413.89
        move_line_results = [
            ('620200', 'debit', 3487.5),        # remuneration
            ('453000', 'credit', 372.49),       # PP
            ('643000', 'debit', 1162.5),        # IP
            ('453000', 'credit', 87.19),        # IP DED
            ('454000', 'credit', 477.85),       # ONSS - Emp Bonus
            ('454000', 'credit', 27.81),        # Misc ONSS
            ('620200', 'debit', 197),           # Private Car
            ('620200', 'debit', 300),           # Representation Fees
            ('455000', 'credit', 50.14),        # Meal vouchers
            ('455000', 'credit', 4131.52),      # NET
            ('454000', 'credit', 1266.89),      # ONSS Employer
            ('621000', 'debit', 1266.89),       # ONSS Employer
        ]
        # ================================================ #
        #         Accounting entries for Batch             #
        # ================================================ #
        # Account   Formula                                                     Debit       Credit
        # 620200    Remuneration: Basic_Salary - IP                            3487.5
        # 453000    Withholding Taxes  Precompte - low salary bonus                         372.49

        # 643000    IP                                                         1162.5
        # 453000    IP Deduction                                                             87.19

        # 454000    ONSS worker - Employment Bonus                                          477.85
        # 454000    ONSS Misceleneous                                                        27.81

        # 620200    Private Car                                                   197
        # 620200    Frais de rep                                                  300

        # 455000    Meal vouchers retenue                                                    50.14
        # 455000    Remunration dues = NET                                                 4131.52

        # 454000    ONSS Employer                                                          1266.89
        # 621000    ONSS Employer                                             1266.89
        # ----------------------------------------------------------------------------------------
        # BALANCE                                                             6413.89      6413.89

        self.assertEqual(len(move_lines), 12)
        self.assertFalse(float_compare(sum(l.debit for l in move_lines), balance, 2))
        self.assertFalse(float_compare(sum(l.credit for l in move_lines), balance, 2))
        self._validate_move_lines(move_lines, move_line_results)

    def test_accounting_entries_commissions(self):
        # hr_payroll_structure_cp200_structure_commission
        # Test case: Create 2 payslips (1 classic / 1 low salary)
        # Generate and validate the accounting entries

        # YTI: Drop this in master
        structure = self.env.ref('l10n_be_hr_payroll_variable_revenue.hr_payroll_structure_cp200_structure_commission', raise_if_not_found=False)
        if not structure:
            return

        # 1rst contract
        self.contract.write({
            'date_generated_from': datetime.datetime(2020, 12, 1, 0, 0, 0),
            'date_generated_to': datetime.datetime(2020, 12, 1, 0, 0, 0),
        })

        # Second contract
        second_employee = self.env['hr.employee'].create([{
            'name': "Test Employee",
            'address_home_id': self.address_home.id,
            'resource_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'marital': "single",
            'km_home_work': 75,
        }])

        second_car = self.env['fleet.vehicle'].create([{
            'name': "Test Car 2",
            'license_plate': "TEST2",
            'driver_id': second_employee.address_home_id.id,
            'company_id': self.env.company.id,
            'model_id': self.model.id,
            'first_contract_date': datetime.date(2020, 12, 17),
            'co2': 88.0,
            'car_value': 38000.0,
            'fuel_type': "diesel",
            'acquisition_date': datetime.date(2020, 1, 1)
        }])

        second_vehicle_contract = self.env['fleet.vehicle.log.contract'].create({
            'name': "Test Contract",
            'vehicle_id': second_car.id,
            'company_id': self.env.company.id,
            'start_date': datetime.date(2020, 12, 17),
            'expiration_date': datetime.date(2021, 12, 17),
            'state': "open",
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 450.0
        })

        second_contract = self.env['hr.contract'].create([{
            'name': "Contract For Payslip Test",
            'employee_id': second_employee.id,
            'resource_calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'date_generated_from': datetime.datetime(2020, 12, 1, 0, 0, 0),
            'date_generated_to': datetime.datetime(2020, 12, 1, 0, 0, 0),
            'car_id': second_car.id,
            'structure_type_id': self.env.ref('hr_contract.structure_type_employee_cp200').id,
            'date_start': datetime.date(2018, 12, 31),
            'wage': 1500.0,
            'state': "open",
            'transport_mode_car': True,
            'fuel_card': 150.0,
            'internet': 38.0,
            'representation_fees': 150.0,
            'mobile': 30.0,
            'meal_voucher_amount': 7.45,
            'eco_checks': 250.0,
            'ip_wage_rate': 25.0,
            'ip': True,
        }])

        # Generate Batch / payslips
        work_entries = self.contract._generate_work_entries(datetime.date(2020, 12, 1), datetime.date(2020, 12, 31))
        payslip_run_id = self.env['hr.payslip.employees'].with_context(
            default_date_start='2020-12-01',
            default_date_end='2020-12-31',
            default_structure_id=structure.id,
            allowed_company_ids=self.env.company.ids,
        ).create({}).compute_sheet()['res_id']
        payslip_run = self.env['hr.payslip.run'].browse(payslip_run_id)

        payslips = payslip_run.slip_ids
        self.assertEqual(len(payslips), 2)

        payslip_1 = payslips.filtered(lambda p: p.employee_id == self.employee)
        payslip_1.input_line_ids.amount = 3000
        payslip_1.compute_sheet()

        self.assertEqual(len(payslip_1.worked_days_line_ids), 0)
        self.assertEqual(len(payslip_1.input_line_ids), 1)
        self.assertEqual(len(payslip_1.line_ids), 16)

        payslip_results = {
            'BASIC': 2650.0,
            'COM': 3000.0,
            'SALARY': 5650.0,
            'ONSS': -738.46,
            'GROSS': 4911.55,
            'P.P': -1784.93,
            'M.ONSS': -48.54,
            'ONSS.ADJ': 346.36,
            'P.P.ADJ': 636.82,
            'M.ONSS.ADJ': 23.66,
            'BASIC.ADJ': -2650.0,
            'ONSS.TOTAL': 392.1,
            'PPTOTAL': 1148.11,
            'M.ONSS.TOTAL': 24.88,
            'NET': 1434.91,
            'ONSSEMPLOYER': 814.2,
        }
        self._validate_payslip(payslip_1, payslip_results)

        # ================================================ #
        #         Accounting entries for slip 1            #
        # ================================================ #
        # Basic salary 2650 - Commissions 3000

        # Account   Formula                                                     Debit       Credit
        # 620200    Remuneration: Commissions                                    3000
        # 453000    Withholding Taxes  Precompte - low salary bonus - adj                  1148.11

        # 454000    ONSS worker - Employment Bonus - adj                                     392.1
        # 454000    ONSS Misceleneous - adj                                                  24.88

        # 455000    Remunration dues = NET                                                 1434.91

        # 454000    ONSS Employer                                                           814.19
        # 621000    ONSS Employer                                              814.19
        # ----------------------------------------------------------------------------------------
        # BALANCE                                                             3814.19      3814.19

        payslip_2 = payslips.filtered(lambda p: p.employee_id == second_employee)
        payslip_2.input_line_ids.amount = 500
        payslip_2.compute_sheet()

        self.assertEqual(len(payslip_2.worked_days_line_ids), 0)
        self.assertEqual(len(payslip_2.input_line_ids), 1)
        self.assertEqual(len(payslip_2.line_ids), 18)

        payslip_results = {
            'BASIC': 1500.0,
            'COM': 500.0,
            'SALARY': 2000.0,
            'ONSS': -261.4,
            'EmpBonus.1': 134.23,
            'GROSS': 1872.83,
            'P.P': -272.36,
            'P.P.DED': 44.48,
            'M.ONSS': 0.0,
            'ONSS.ADJ': 0.0,
            'P.P.ADJ': 162.76,
            'M.ONSS.ADJ': 0.0,
            'BASIC.ADJ': -1500.0,
            'ONSS.TOTAL': 127.17,
            'PPTOTAL': 65.11,
            'M.ONSS.TOTAL': 0.0,
            'NET': 307.72,
            'ONSSEMPLOYER': 135.7,
        }
        self._validate_payslip(payslip_2, payslip_results)
        # ================================================ #
        #         Accounting entries for slip 2            #
        # ================================================ #
        # Basic salary 1500 - Commissions 500

        # Account   Formula                                                     Debit       Credit
        # 620200    Remuneration: Commissions                                     500
        # 453000    Withholding Taxes  Precompte - low salary bonus - adj                    65.12

        # 454000    ONSS worker - Employment Bonus - adj                                    127.17
        # 454000    ONSS Misceleneous - adj                                                      0

        # 455000    Remunration dues = NET                                                  307.71

        # 454000    ONSS Employer                                                           135.07
        # 621000    ONSS Employer                                              135.07
        # ----------------------------------------------------------------------------------------
        # BALANCE                                                               635.7        635.7
        # Generate accounting entries
        payslip_run.action_validate()
        account_move = payslip_1.move_id
        move_lines = account_move.line_ids

        balance = 4449.9
        move_line_results = [
            ('620200', 'debit', 3500),        # remuneration
            ('453000', 'credit', 1213.22),       # PP
            ('454000', 'credit', 519.27),       # ONSS - Emp Bonus
            ('454000', 'credit', 24.88),        # Misc ONSS
            ('455000', 'credit', 1742.63),      # NET
            ('454000', 'credit', 949.9),      # ONSS Employer
            ('621000', 'debit', 949.9),       # ONSS Employer
        ]
        # ================================================ #
        #         Accounting entries for Batch             #
        # ================================================ #
        # Account   Formula                                                     Debit       Credit
        # 620200    Remuneration: Commissions                                    3500
        # 453000    Withholding Taxes  Precompte - low salary bonus - adj                  1213.23

        # 454000    ONSS worker - Employment Bonus - adj                                    519.27
        # 454000    ONSS Misceleneous - adj                                                  24.88

        # 455000    Remunration dues = NET                                                 1742.62

        # 454000    ONSS Employer                                                           949.89
        # 621000    ONSS Employer                                              949.89
        # ----------------------------------------------------------------------------------------
        # BALANCE                                                             4449.89      4449.89
        # Generate accounting entries

        self.assertEqual(len(move_lines), 7)
        self.assertFalse(float_compare(sum(l.debit for l in move_lines), balance, 2))
        self.assertFalse(float_compare(sum(l.credit for l in move_lines), balance, 2))
        self._validate_move_lines(move_lines, move_line_results)

    def test_long_term_sick_leave(self):
        public_holiday = self.env['resource.calendar.leaves'].create([{
            'name': "Absence",
            'calendar_id': self.resource_calendar_38_hours_per_week.id,
            'company_id': self.env.company.id,
            'date_from': datetime.datetime(2020, 3, 17, 6, 0, 0),
            'date_to': datetime.datetime(2020, 3, 17, 18, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }])

        long_term_sick = self.env['hr.leave'].new({
            'name': 'Long Term Sick',
            'employee_id': self.employee.id,
            'holiday_status_id': self.long_term_sick_time_off_type.id,
            'request_date_from': datetime.date(2020, 3, 1),
            'request_date_to': datetime.date(2020, 3, 31),
            'request_hour_from': '7',
            'request_hour_to': '18',
            'number_of_days': 22,
        })
        long_term_sick._compute_date_from_to()
        long_term_sick = self.env['hr.leave'].create(long_term_sick._convert_to_write(long_term_sick._cache))
        long_term_sick.action_validate()

        payslip = self._generate_payslip(datetime.date(2020, 3, 1), datetime.date(2020, 3, 31))

        self.assertEqual(len(payslip.worked_days_line_ids), 1)
        self.assertEqual(len(payslip.input_line_ids), 0)
        self.assertEqual(len(payslip.line_ids), 23)

        self.assertAlmostEqual(payslip._get_worked_days_line_amount('LEAVE280'), 0.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_days('LEAVE280'), 22.0, places=2)
        self.assertAlmostEqual(payslip._get_worked_days_line_number_of_hours('LEAVE280'), 167.2, places=2)

        payslip_results = {
            'BASIC': 0.0,
            'ATN.INT': 5.0,
            'ATN.MOB': 4.0,
            'SALARY': 9.0,
            'ONSS': -1.18,
            'ONSSTOTAL': 1.18,
            'ATN.CAR': 141.14,
            'GROSS': 148.97,
            'P.P': 0.0,
            'PPTOTAL': 0.0,
            'ATN.CAR.2': -141.14,
            'ATN.INT.2': -5.0,
            'ATN.MOB.2': -4.0,
            'M.ONSS': 0.0,
            'MEAL_V_EMP': 0.0,
            'REP.FEES': 0.0,
            'NET': -1.18,
            'REMUNERATION': 0.0,
            'ONSSEMPLOYER': 2.44,
        }
        self._validate_payslip(payslip, payslip_results)
