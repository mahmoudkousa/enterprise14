# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestTimesheet(TransactionCase):

    def setUp(self):
        super(TestTimesheet, self).setUp()

        self.partner = self.env['res.partner'].create({
            'name': 'Customer Task',
            'email': 'customer@task.com',
        })

        self.analytic_account = self.env['account.analytic.account'].create({
            'name': 'Analytic Account for Test Customer',
            'partner_id': self.partner.id,
            'code': 'TEST'
        })

    def test_allow_timesheets_and_timer(self):
        """
        Check that a modification of the 'allow_timesheets' field updates correctly the
        'allow_timesheet_timer' field.
        """
        Project = self.env['project.project']
        HelpdeskTeam = self.env['helpdesk.team']

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

        # case 5: a helpdesk team without timesheet timer
        helpdeskTeam_1 = HelpdeskTeam.create({
            'name': 'Team #1',
            'project_id': project_1.id,
            'timesheet_timer': False,
        })

        self.assertTrue(
            helpdeskTeam_1.project_id.allow_timesheet_timer,
            "If 'allow_timesheets' is TRUE and 'timesheet_timer' is FALSE, 'allow_timesheet_timer' shall be set to TRUE")

        # case 5: a helpdesk team with a timesheet timer
        helpdeskTeam_2 = HelpdeskTeam.create({
            'name': 'Team #2',
            'project_id': project_2.id,
            'timesheet_timer': True,
        })

        self.assertTrue(
            helpdeskTeam_2.project_id.allow_timesheet_timer,
            "If 'allow_timesheets' is FALSE and 'timesheet_timer' is TRUE,"
            " 'allow_timesheet_timer' shall be set to TRUE")

        # case 6: project with 'allow_timesheets' set to FALSE and team with
        # 'timesheet_timer' set to FALSE.
        project_3 = Project.create({
            'name': 'Project 3',
            'allow_timesheets': False,
            'partner_id': self.partner.id
        })

        helpdeskTeam_3 = HelpdeskTeam.create({
            'name': 'Team #3',
            'project_id': project_3.id,
            'timesheet_timer': False,
        })

        self.assertFalse(
            helpdeskTeam_3.project_id.allow_timesheet_timer,
            "If 'allow_timesheets' is FALSE and 'timesheet_timer' is FALSE,"
            " 'allow_timesheet_timer' shall be set to FALSE")

    def test_compute_timesheet_partner_from_ticket_customer(self):
        partner2 = self.env['res.partner'].create({
            'name': 'Customer ticket',
            'email': 'customer@ticket.com',
        })
        helpdesk_team = self.env['helpdesk.team'].create({
            'name': 'Test Team',
            'use_helpdesk_timesheet': True,
        })
        helpdesk_ticket = self.env['helpdesk.ticket'].create({
            'name': 'Test Ticket',
            'team_id': helpdesk_team.id,
            'partner_id': self.partner.id,
        })
        timesheet_entry = self.env['account.analytic.line'].create({
            'name': 'the only timesheet. So lonely...',
            'helpdesk_ticket_id': helpdesk_ticket.id,
            'project_id': helpdesk_team.project_id.id,
        })

        self.assertEqual(timesheet_entry.partner_id, self.partner, "The timesheet entry's partner should be equal to the ticket's partner/customer")

        helpdesk_ticket.write({'partner_id': partner2.id})

        self.assertEqual(timesheet_entry.partner_id, partner2, "The timesheet entry's partner should still be equal to the ticket's partner/customer, after the change")
