# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, datetime
from dateutil.relativedelta import relativedelta

from odoo import fields
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase


class TestHrAppraisal(TransactionCase):
    """ Test used to check that when doing appraisal creation."""

    def setUp(self):
        super(TestHrAppraisal, self).setUp()
        self.HrEmployee = self.env['hr.employee']
        self.HrAppraisal = self.env['hr.appraisal']
        self.Request = self.env['request.appraisal']
        self.main_company = self.env.ref('base.main_company')

        self.dep_rd = self.env['hr.department'].create({'name': 'RD Test'})
        self.manager_user = self.env['res.users'].create({
            'name': 'Manager User',
            'login': 'manager_user',
            'password': 'manager_user',
            'email': 'demo@demo.com',
            'partner_id': self.env['res.partner'].create({'name': 'Manager Partner'}).id,
        })
        self.manager = self.env['hr.employee'].create({
            'name': 'Manager Test',
            'department_id': self.dep_rd.id,
            'user_id': self.manager_user.id,
        })

        self.job = self.env['hr.job'].create({'name': 'Developer Test', 'department_id': self.dep_rd.id})
        self.colleague = self.env['hr.employee'].create({'name': 'Colleague Test', 'department_id': self.dep_rd.id})

        group = self.env.ref('hr_appraisal.group_hr_appraisal_user').id
        self.user = self.env['res.users'].create({
            'name': 'Michael Hawkins',
            'login': 'test',
            'groups_id': [(6, 0, [group])],
        })

        self.hr_employee = self.HrEmployee.create(dict(
            name="Michael Hawkins",
            user_id=self.user.id,
            department_id=self.dep_rd.id,
            parent_id=self.manager.id,
            job_id=self.job.id,
            work_location="Grand-Rosière",
            work_phone="+3281813700",
            work_email='michael@odoo.com',
            last_appraisal_date=date.today() + relativedelta(months=-12, days=5)
        ))

        self.env.company.appraisal_plan = True
        self.env['ir.config_parameter'].sudo().set_param("hr_appraisal.appraisal_create_in_advance_days", 8)
        self.env['hr.appraisal.plan'].search([]).unlink()
        self.env['hr.appraisal.plan'].create({
            'duration': 12,
            'event': 'last_appraisal',
        })

    def test_hr_appraisal(self):
        # I run the scheduler
        self.env['hr.appraisal.plan']._run_employee_appraisal_plans()  # cronjob

        # I check whether new appraisal is created for above employee or not
        appraisals = self.HrAppraisal.search([('employee_id', '=', self.hr_employee.id)])
        self.assertTrue(appraisals, "Appraisal not created")

        # I start the appraisal process by click on "Start Appraisal" button.
        appraisals.action_confirm()

        # I check that state is "Appraisal Sent".
        self.assertEqual(appraisals.state, 'pending', "appraisal should be 'Appraisal Sent' state")
        # I check that "Final Interview Date" is set or not.
        event = self.env['calendar.event'].create({
            "name":"Appraisal Meeting",
            "start": datetime.now() + relativedelta(months=1),
            "stop":datetime.now() + relativedelta(months=1, hours=2),
            "duration":2,
            "allday": False,
            'res_id': appraisals.id,
            'res_model_id': self.env.ref('hr_appraisal.model_hr_appraisal').id
        })
        self.assertTrue(appraisals.date_final_interview, "Interview Date is not created")
        # I check whether final interview meeting is created or not
        self.assertTrue(appraisals.meeting_id, "Meeting is not linked")
        # I close this Apprisal
        appraisals.action_done()
        # I check that state of Appraisal is done.
        self.assertEqual(appraisals.state, 'done', "Appraisal should be in done state")

    def test_new_employee_next_appraisal_date_generation(self):
        # keep this test to ensure we don't break this functionnality at 
        # a later date
        hr_employee3 = self.HrEmployee.create(dict(
            name="Jane Doe",
        ))

        self.assertEqual(hr_employee3.last_appraisal_date, date.today())

    def test_01_appraisal_generation(self):
        """
            Set appraisal date at the exact time it should be to 
            generate a new appraisal
            Run the cron and check that the next appraisal_date is set properly
        """
        self.hr_employee.last_appraisal_date = date.today() - relativedelta(months=12, days=-8)
        self.env['hr.appraisal.plan']._run_employee_appraisal_plans()
        appraisals = self.HrAppraisal.search([('employee_id', '=', self.hr_employee.id)])
        self.assertTrue(appraisals, "Appraisal not created")
        self.assertEqual(appraisals.date_close, date.today() + relativedelta(days=8))
        self.assertEqual(self.hr_employee.next_appraisal_date, date.today() + relativedelta(days=8))

        self.env['hr.appraisal.plan']._run_employee_appraisal_plans()
        appraisals_2 = self.HrAppraisal.search([('employee_id', '=', self.hr_employee.id)])
        self.assertEqual(len(appraisals), len(appraisals_2))

    def test_02_no_appraisal_generation(self):
        """
            Set appraisal date later than the time it should be to generate
            a new appraisal
            Run the cron and check the appraisal is not created
        """
        self.hr_employee.last_appraisal_date = date.today() - relativedelta(months=12, days=-9)

        self.env['hr.appraisal.plan']._run_employee_appraisal_plans()
        appraisals = self.HrAppraisal.search([('employee_id', '=', self.hr_employee.id)])
        self.assertFalse(appraisals, "Appraisal created")

    def test_03_appraisal_generation_in_the_past(self):
        """
            Set appraisal date way before the time it should be to generate
            a new appraisal
            Run the cron and check the appraisal is created with the proper
            close_date and appraisal date
        """
        self.hr_employee.last_appraisal_date = date.today() - relativedelta(months=24)

        self.env['hr.appraisal.plan']._run_employee_appraisal_plans()
        appraisals = self.HrAppraisal.search([('employee_id', '=', self.hr_employee.id)])
        self.assertTrue(appraisals, "Appraisal not created")
        self.assertEqual(appraisals.date_close, date.today() + relativedelta(days=8))
        self.assertEqual(self.hr_employee.next_appraisal_date, date.today() + relativedelta(days=8))

        self.env['hr.appraisal.plan']._run_employee_appraisal_plans()
        appraisals_2 = self.HrAppraisal.search([('employee_id', '=', self.hr_employee.id)])
        self.assertEqual(len(appraisals), len(appraisals_2))

    def test_07_check_manual_appraisal_set_appraisal_date(self):
        """
            Create manualy an appraisal with a date_close
            Check the appraisal_date is set properly
        """
        future_appraisal = self.HrAppraisal.create({
            'employee_id': self.hr_employee.id,
            'date_close': date.today() + relativedelta(months=1),
            'state': 'new'
        })
        self.assertEqual(self.hr_employee.next_appraisal_date, date.today() + relativedelta(months=1))

    def test_08_request_appraisal_from_employee(self):
        """
            As manager request an appraisal with your employee
        """
        template_employee_id = self.env.ref('hr_appraisal.mail_template_appraisal_request').id
        Request = self.Request.with_context(active_model='hr.employee', active_id=self.hr_employee.id)
        default = Request.default_get(['template_id'])
        self.assertEqual(default['template_id'], template_employee_id)
        default['deadline'] = date.today() + relativedelta(months=1)
        request = Request.create(default)
        request.action_invite()

        appraisals = self.HrAppraisal.search([
            ('employee_id', '=', self.hr_employee.id),
        ])
        self.assertTrue(appraisals, "Appraisal not created")
        self.assertTrue(self.hr_employee.next_appraisal_date, date.today() + relativedelta(months=1))

    def test_09_request_appraisal_from_user(self):
        """
            request an appraisal for yourself with your manager
        """
        template_employee_id = self.env.ref('hr_appraisal.mail_template_appraisal_request_from_employee').id
        Request = self.Request.with_context(active_model='res.users', active_id=self.hr_employee.user_id.id)
        default = Request.default_get(['template_id'])
        self.assertEqual(default['template_id'], template_employee_id)
        # Check the recipient is the manager define on the employee
        self.assertEqual(default['recipient_ids'], self.manager.user_id.partner_id.ids)
        default.update({
            'deadline': date.today() + relativedelta(months=1),
        })
        request = Request.create(default)
        request.action_invite()

        appraisals = self.HrAppraisal.search([
            ('employee_id', '=', self.hr_employee.id),
        ])
        self.assertTrue(appraisals, "Appraisal not created")
        self.assertTrue(self.hr_employee.next_appraisal_date, date.today() + relativedelta(months=1))

    def test_10_link_meeting_to_an_appraisal(self):
        """
            Create an appraisal meeting and edit it directly without saving it before
        """
        # Create an appraisal.
        appraisal = self.HrAppraisal.create({
            'employee_id': self.hr_employee.id,
        })
        # Check that an appraisal is correctly created
        self.assertTrue(appraisal, "Appraisal not created")
        self.assertFalse(appraisal.meeting_id, "Appraisal must not have a related event")
        # Create a calendar event with the context of an appraisal
        # to simulate editing an appraisal event without save it before.
        # The 'res_id' is zero when creating a calendar event from the edition view.
        # The 'create' function has to determine the 'res_id' of the appraisal based on the context.
        self.env['calendar.event'].with_context(active_id=appraisal.id, active_model='hr.appraisal').create({
            "name":"Appraisal Meeting",
            'res_id': 0,
        })
        # check that a meeting is linked to the appraisal.
        self.assertTrue(appraisal.meeting_id, "Appraisal must have a related event")
