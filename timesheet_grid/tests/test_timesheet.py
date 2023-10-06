# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from odoo import fields

from odoo.addons.hr_timesheet.tests.test_timesheet import TestCommonTimesheet
from odoo.exceptions import AccessError

try:
    from unittest.mock import patch
except ImportError:
    from mock import patch

class TestTimesheetValidation(TestCommonTimesheet):

    def setUp(self):
        super(TestTimesheetValidation, self).setUp()
        self.project_customer.allow_timesheet_timer = True
        today = fields.Date.today()
        self.timesheet1 = self.env['account.analytic.line'].with_user(self.user_employee).create({
            'name': "my timesheet 1",
            'project_id': self.project_customer.id,
            'task_id': self.task1.id,
            'date': today,
            'unit_amount': 2.0,
        })
        self.timesheet2 = self.env['account.analytic.line'].with_user(self.user_employee).create({
            'name': "my timesheet 2",
            'project_id': self.project_customer.id,
            'task_id': self.task2.id,
            'date': today,
            'unit_amount': 3.11,
        })

    def test_timesheet_validation_user(self):
        """ Employee record its timesheets and Officer validate them. Then try to modify/delete it and get Access Error """
        # Officer validate timesheet of 'user_employee' through wizard
        timesheet_to_validate = self.timesheet1 | self.timesheet2
        timesheet_to_validate.with_user(self.user_manager).action_validate_timesheet()

        # Check timesheets 1 and 2 are validated
        self.assertTrue(self.timesheet1.validated)
        self.assertTrue(self.timesheet2.validated)

        # Employee can not modify validated timesheet
        with self.assertRaises(AccessError):
            self.timesheet1.with_user(self.user_employee).write({'unit_amount': 5})
        # Employee can not delete validated timesheet
        with self.assertRaises(AccessError):
            self.timesheet2.with_user(self.user_employee).unlink()

        # Employee can still create new timesheet before the validated date
        last_month = datetime.now() - relativedelta(months=1)
        self.env['account.analytic.line'].with_user(self.user_employee).create({
            'name': "my timesheet 3",
            'project_id': self.project_customer.id,
            'task_id': self.task2.id,
            'date': last_month,
            'unit_amount': 2.5,
        })

        # Employee can still create timesheet after validated date
        next_month = datetime.now() + relativedelta(months=1)
        timesheet4 = self.env['account.analytic.line'].with_user(self.user_employee).create({
            'name': "my timesheet 4",
            'project_id': self.project_customer.id,
            'task_id': self.task2.id,
            'date': next_month,
            'unit_amount': 2.5,
        })
        # And can still update non validated timesheet
        timesheet4.write({'unit_amount': 7})

    def test_timesheet_validation_manager(self):
        """ Officer can see timesheets and modify the ones of other employees """
       # Officer validate timesheet of 'user_employee' through wizard
        timesheet_to_validate = self.timesheet1 | self.timesheet2
        timesheet_to_validate.with_user(self.user_manager).action_validate_timesheet()
        # manager modify validated timesheet
        self.timesheet1.with_user(self.user_manager).write({'unit_amount': 5})

    def test_timesheet_validation_stop_timer(self):
        """ Check that the timers are stopped when validating the task even if the timer belongs to another user """
        # Start timer with employee user
        timesheet = self.timesheet1
        start_unit_amount = timesheet.unit_amount
        timesheet.with_user(self.user_employee).action_timer_start()
        timer = self.env['timer.timer'].search([("user_id", "=", self.user_employee.id), ('res_model', '=', 'account.analytic.line')])
        self.assertTrue(timer, 'A timer has to be running for the user employee')
        # Validate timesheet with manager user
        timesheet.with_user(self.user_manager).action_validate_timesheet()
        # Check if old timer is stopped
        self.assertFalse(timer.exists())
        # Check if time spent is add to the validated timesheet
        self.assertGreater(timesheet.unit_amount, start_unit_amount, 'The unit amount has to be greater than at the beginning')

    def _test_next_date(self, now, result, delay, interval):

        def _now(*args, **kwargs):
            return now

        # To allow testing

        patchers = [patch('odoo.fields.Datetime.now', _now)]

        for p in patchers:
            p.start()

        self.user_manager.company_id.write({
            'timesheet_mail_manager_interval': interval,
            'timesheet_mail_manager_delay': delay,
        })

        self.assertEqual(result, self.user_manager.company_id.timesheet_mail_manager_nextdate)

        for p in patchers:
            p.stop()

    def test_timesheet_next_date_reminder_neg_delay(self):

        result = datetime(2020, 4, 23, 8, 8, 15)
        now = datetime(2020, 4, 22, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")

        result = datetime(2020, 4, 30, 8, 8, 15)
        now = datetime(2020, 4, 23, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")
        now = datetime(2020, 4, 24, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")
        now = datetime(2020, 4, 25, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")

        result = datetime(2020, 4, 27, 8, 8, 15)
        now = datetime(2020, 4, 26, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")

        result = datetime(2020, 5, 28, 8, 8, 15)
        now = datetime(2020, 4, 27, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")
        now = datetime(2020, 4, 28, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")
        now = datetime(2020, 4, 29, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")

        result = datetime(2020, 2, 27, 8, 8, 15)
        now = datetime(2020, 2, 26, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")

        result = datetime(2020, 3, 5, 8, 8, 15)
        now = datetime(2020, 2, 27, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")
        now = datetime(2020, 2, 28, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")
        now = datetime(2020, 2, 29, 8, 8, 15)
        self._test_next_date(now, result, -3, "weeks")

        result = datetime(2020, 2, 26, 8, 8, 15)
        now = datetime(2020, 2, 25, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")

        result = datetime(2020, 3, 28, 8, 8, 15)
        now = datetime(2020, 2, 26, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")
        now = datetime(2020, 2, 27, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")
        now = datetime(2020, 2, 28, 8, 8, 15)
        self._test_next_date(now, result, -3, "months")

    def test_minutes_computing_after_timer_stop(self):
        """ Test if unit_amount is updated after stoping a timer """
        Timesheet = self.env['account.analytic.line']
        timesheet_1 = Timesheet.with_user(self.user_employee).create({
            'project_id': self.project_customer.id,
            'task_id': self.task1.id,
            'name': '/',
            'unit_amount': 1,
        })

        # When the timer is greater than 1 minute
        now = datetime.now()
        timesheet_1.with_user(self.user_employee).action_timer_start()
        timesheet_1.with_user(self.user_employee).user_timer_id.timer_start = now - timedelta(minutes=1, seconds=28)
        timesheet_1.with_user(self.user_employee).action_timer_stop()

        self.assertGreater(timesheet_1.unit_amount, 1, 'unit_amount should be greated than his last value')

    def test_allow_timesheets_and_timer(self):
        """
        Check that a modification of the 'allow_timesheets' field updates correctly the
        'allow_timesheet_timer' field.
        """
        Project = self.env['project.project']

        # case 1: create a project with allow_timesheets set to FALSE
        project_1 = Project.create({
            'name': 'Project 1',
            'allow_timesheets': False,
            'partner_id': self.partner.id
        })

        self.assertFalse(
            project_1.allow_timesheet_timer,
            "On project creation with 'allow_timesheets' set to FALSE, 'allow_timesheet_timer' shall be set to FALSE")

        # case 2: create a project with allow_timesheets set to TRUE
        project_2 = Project.create({
            'name': 'Project 2',
            'allow_timesheets': True,
            'partner_id': self.partner.id,
            'analytic_account_id': self.analytic_account.id
        })

        self.assertTrue(
            project_2.allow_timesheet_timer,
            "On project creation with 'allow_timesheets' set to TRUE, 'allow_timesheet_timer' shall be set to TRUE")

        # case 3: change 'allow_timesheets' from FALSE to TRUE
        project_1.write({
            'allow_timesheets': True
        })

        self.assertTrue(
            project_1.allow_timesheet_timer,
            "On 'allow_timesheets' change to TRUE, 'allow_timesheet_timer' shall be set to TRUE")

        # case 4: change 'allow_timesheets' from TRUE to FALSE
        project_2.write({
            'allow_timesheets': False
        })

        self.assertFalse(
            project_2.allow_timesheet_timer,
            "On 'allow_timesheets' change to FALSE, 'allow_timesheet_timer' shall be set to FALSE")

    def test_action_add_time_to_timer_multi_company(self):
        company = self.env['res.company'].create({'name': 'My_Company'})
        self.env['hr.employee'].with_company(company).create({
            'name': 'coucou',
            'user_id': self.user_manager.id,
        })
        self.user_manager.write({'company_ids': [(4, company.id)]})
        timesheet = self.env['account.analytic.line'].with_user(self.user_manager).create({'name': 'coucou', 'project_id': self.project_customer.id})
        timesheet.with_user(self.user_manager).action_add_time_to_timer(1)
