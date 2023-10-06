# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase, new_test_user


class TestHrAppraisalRequest(TransactionCase):

    def setUp(self):
        super().setUp()

        self.manager_user = new_test_user(self.env, login='Lucky Luke')
        self.manager = self.env['hr.employee'].create({
            'name': 'Manager Tiranique',
            'user_id': self.manager_user.id,
        })
        self.employee_user = new_test_user(self.env, login='Rantanplan')
        self.employee = self.env['hr.employee'].create({
            'name': "Michaël Hawkins",
            'parent_id': self.manager.id,
            'work_email': 'michael@odoo.com',
            'user_id': self.employee_user.id,
            'address_home_id': self.env['res.partner'].create({'name': 'Private contact', 'email': 'private@email.com'}).id,
        })
        self.employee.work_email = 'chouxblanc@donc.com'

    def request_appraisal_from(self, record, user):
        """ An appraisal can be requested from two places
            - the employee form view (meant for the employee manager)
            - the employee profile (res.user) (meant for the employee himself)
        """
        return self.env['request.appraisal'] \
            .with_user(user) \
            .with_context(active_model=record._name, active_id=record.id) \
            .create({'deadline': date.today()})

    def test_manager_simple_request(self):
        """ Manager requests an appraisal for one of his employee """
        request  = self.request_appraisal_from(self.employee, user=self.manager_user)
        self.assertEqual(request.employee_id, self.employee)
        self.assertEqual(request.recipient_ids, self.employee_user.partner_id, "It should be sent to the employee user's partner")
        self.assertTrue('Dear %s' % self.employee_user.name in request.body)
        request.action_invite()

    def test_manager_request_work_email(self):
        """ Send appraisal to work email """
        self.employee.user_id = False
        request  = self.request_appraisal_from(self.employee, user=self.manager_user)
        self.assertEqual(request.recipient_ids.email, self.employee.work_email)
        self.assertEqual(request.recipient_ids.name, self.employee.name)
        request.action_invite()

    def test_manager_request_work_email(self):
        """ Send appraisal to work email """
        self.employee.user_id = False
        self.employee.address_home_id = False
        request  = self.request_appraisal_from(self.employee, user=self.manager_user)
        self.assertEqual(request.recipient_ids.email, self.employee.work_email)

    def test_manager_request_himself(self):
        """ Send appraisal to only manager if HR asks for himself """
        # Employee can request an appraisal for himself from employee form
        request  = self.request_appraisal_from(self.employee, user=self.employee_user)
        self.assertEqual(request.recipient_ids, self.manager_user.partner_id)

    def test_manager_activity(self):
        """ Activity created for employee """
        request  = self.request_appraisal_from(self.employee, user=self.manager_user)
        request.action_invite()
        appraisal = self.env['hr.appraisal'].search([('employee_id', '=', self.employee.id)])
        self.assertEqual(appraisal.activity_ids.user_id, self.employee_user, "Should have an activity for the employee")

    def test_manager_activity_no_user(self):
        """ Activity created for manager if employee doesn't have a user """
        self.employee.user_id = False
        self.employee.work_email = "chouxblanc@donc.com"  # Otherwise, finds the partner of the (previous) user
        request  = self.request_appraisal_from(self.employee, user=self.manager_user)
        request.action_invite()
        appraisal = self.env['hr.appraisal'].search([('employee_id', '=', self.employee.id)])

        self.assertEqual(appraisal.activity_ids.user_id, self.manager_user, "Should have an activity for the manager")

    def test_employee_simple_request(self):
        """ Employee requests an appraisal from his manager """
        request  = self.request_appraisal_from(self.employee_user, user=self.employee_user)
        self.assertEqual(request.employee_id, self.employee)
        self.assertEqual(request.recipient_ids, self.manager_user.partner_id, "It should be sent to the manager's partner")
        self.assertTrue('Dear %s' % self.manager_user.name in request.body)
        request.action_invite()

    def test_custom_body(self):
        """ Custom body should be sent """
        request  = self.request_appraisal_from(self.employee_user, user=self.employee_user)
        request.body = "My awesome message"
        request.action_invite()
        appraisal = self.env['hr.appraisal'].search([('employee_id', '=', self.employee.id)])
        notification = self.env['mail.message'].search([
            ('model', '=', appraisal._name),
            ('res_id', '=', appraisal.id),
            ('message_type', '=', 'user_notification'),
        ])
        self.assertEqual(notification.body, "<p>My awesome message</p>")
