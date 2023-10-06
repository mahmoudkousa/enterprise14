# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from dateutil.relativedelta import relativedelta
from freezegun import freeze_time

import odoo
from odoo.addons.website.tests.test_website_visitor import MockVisitor
from werkzeug.urls import url_encode

from odoo.tests import common, tagged
from odoo.tests.common import new_test_user


@tagged('-at_install', 'post_install')
class WebsiteCalendarTest(common.HttpCase, MockVisitor):

    def setUp(self):
        super(WebsiteCalendarTest, self).setUp()

        # calendar events can mess up the availability of our employee later on.
        self.env['calendar.event'].search([]).unlink()

        self.company = self.env['res.company'].search([], limit=1)

        self.resource_calendar = self.env['resource.calendar'].create({
            'name': 'Small Day',
            'company_id': self.company.id
        })

        self.resource_calendar.write({'attendance_ids': [(5, False, False)]})  # Wipe out all attendances

        self.attendance = self.env['resource.calendar.attendance'].create({
            'name': 'monday morning',
            'dayofweek': '0',
            'hour_from': 8,
            'hour_to': 12,
            'calendar_id': self.resource_calendar.id
        })

        self.first_user_in_brussel = self.env['res.users'].create({'name': 'Grace Slick', 'login': 'grace'})
        self.first_user_in_brussel.write({'tz': 'Europe/Brussels'})

        self.second_user_in_australia = self.env['res.users'].create({'name': 'Australian guy', 'login': 'australian'})
        self.second_user_in_australia.write({'tz': 'Australia/West'})

        self.employee = self.env['hr.employee'].create({
            'name': 'Grace Slick',
            'user_id': self.first_user_in_brussel.id,
            'company_id': self.company.id,
            'resource_calendar_id': self.resource_calendar.id
        })

        self.appointment_in_brussel = self.env['calendar.appointment.type'].create({
            'name': 'Go ask Alice',
            'appointment_duration': 1,
            'min_schedule_hours': 1,
            'max_schedule_days': 15,
            'min_cancellation_hours': 1,
            'is_published': True,
            'appointment_tz': 'Europe/Brussels',
            'employee_ids': [(4, self.employee.id, False)],
            'slot_ids': [(0, False, {'weekday': '1', 'hour': 9})]  # Yes, monday has either 0 or 1 as weekday number depending on the object it's in
        })

    def test_extreme_timezone_delta(self):
        context_australia = {'uid': self.second_user_in_australia.id,
                             'tz': self.second_user_in_australia.tz,
                             'lang': 'en_US'}

        # As if the second user called the function
        appointment = self.appointment_in_brussel.with_context(context_australia)

        # Do what the controller actually does 
        months = appointment.sudo()._get_appointment_slots('Europe/Brussels', None)

        # Verifying
        utc_now = datetime.utcnow()
        mondays_count = 0
        # If the appointment has slots in the next month (the appointment can be taken 15 days in advance)
        # We'll have the next month displayed, and if the last day of current month is not a sunday
        # the first week of current month will be in the next month's starting week
        # but greyed and therefore without slot (and we should have already checked that day anyway)
        already_checked = set()

        for month in months:
            for week in month['weeks']:
                for day in week:
                    # For the sake of this test NOT to break each monday,
                    # we only control those mondays that are *strictly* superior than today
                    if day['day'] > utc_now.date() and\
                        day['day'] < (utc_now + relativedelta(days=appointment.max_schedule_days)).date() and\
                        day['day'].weekday() == 0 and\
                        day['day'] not in already_checked:

                        mondays_count += 1
                        already_checked.add(day['day'])
                        self.assertEqual(len(day['slots']), 1, 'Each monday should have only one slot')
                        slot = day['slots'][0]
                        self.assertEqual(slot['employee_id'], self.employee.id, 'The right employee should be available on each slot')
                        self.assertEqual(slot['hours'], '09:00', 'Slots hours has to be 09:00')  # We asked to display the slots as Europe/Brussels

        # Ensuring that we've gone through the *crucial* asserts at least once
        # It might be more accurate to assert mondays_count >= 2, but we don't want this test to break when it pleases
        self.assertGreaterEqual(mondays_count, 1, 'There should be at least one monday in the time range')

    @freeze_time('2023-01-9')
    def test_booking_validity(self):
        """
        When confirming an appointment, we must recheck that it is indeed a valid slot,
        because the user can modify the date URL parameter used to book the appointment.
        We make sure the date is a valid slot, not outside of those specified by the employee,
        and that it's not an old valid slot (a slot that is valid, but it's in the past,
        so we shouldn't be able to book for a date that has already passed)
        """
        # add the timezone of the visitor on the session (same as appointment to simplify)
        session = self.authenticate(None, None)
        session['timezone'] = self.appointment_in_brussel.appointment_tz
        odoo.http.root.session_store.save(session)
        appointment_url = self.appointment_in_brussel.website_url.rsplit("/", 1)[0]
        appointment_info_url = "%s/info?" % appointment_url
        url_inside_of_slot = appointment_info_url + url_encode({
            'employee_id': self.employee.id,
            'date_time': datetime(2023, 1, 9, 9, 0)  # 9/01/2023 is a Monday, there is a slot at 9:00
        })
        response = self.url_open(url_inside_of_slot)
        self.assertEqual(response.status_code, 200, "Response should be Ok (200)")
        url_outside_of_slot = appointment_info_url + url_encode({
            'employee_id': self.employee.id,
            'date_time': datetime(2023, 1, 9, 23, 0)   # 9/01/2023 is a Monday, there is no slot at 23:00
        })
        response = self.url_open(url_outside_of_slot)
        self.assertEqual(response.status_code, 404, "Response should be Page Not Found (404)")
        url_inactive_past_slot = appointment_info_url + url_encode({
            'employee_id': self.employee.id,
            'date_time': datetime(2023, 1, 2, 23, 0)  # 2/01/2023 is a Monday, there is a slot at 9:00, but that Monday has already passed
        })
        response = self.url_open(url_inactive_past_slot)
        self.assertEqual(response.status_code, 404, "Response should be Page Not Found (404)")

    def test_accept_meeting_unauthenticated(self):
        user = new_test_user(self.env, "test_user_1", email="test_user_1@nowhere.com", password="P@ssw0rd!", tz="UTC")
        event = (
            self.env["calendar.event"]
            .create(
                {
                    "name": "Doom's day",
                    "start": datetime(2019, 10, 25, 8, 0),
                    "stop": datetime(2019, 10, 27, 18, 0),
                    "partner_ids": [(4, user.partner_id.id)],
                }
            )
        )
        token = event.attendee_ids[0].access_token
        url = "/calendar/meeting/accept?token=%s&id=%d" % (token, event.id)
        res = self.url_open(url)

        self.assertEqual(res.status_code, 200, "Response should = OK")
        event.attendee_ids[0].invalidate_cache()
        self.assertEqual(event.attendee_ids[0].state, "accepted", "Attendee should have accepted")

    def test_accept_meeting_authenticated(self):
        user = new_test_user(self.env, "test_user_1", email="test_user_1@nowhere.com", password="P@ssw0rd!", tz="UTC")
        event = (
            self.env["calendar.event"]
            .create(
                {
                    "name": "Doom's day",
                    "start": datetime(2019, 10, 25, 8, 0),
                    "stop": datetime(2019, 10, 27, 18, 0),
                    "partner_ids": [(4, user.partner_id.id)],
                }
            )
        )
        token = event.attendee_ids[0].access_token
        url = "/calendar/meeting/accept?token=%s&id=%d" % (token, event.id)
        self.authenticate("test_user_1", "P@ssw0rd!")
        res = self.url_open(url)

        self.assertEqual(res.status_code, 200, "Response should = OK")
        event.attendee_ids[0].invalidate_cache()
        self.assertEqual(event.attendee_ids[0].state, "accepted", "Attendee should have accepted")

    def test_create_appointment_type_from_website(self):
        """ Test that when creating an appointment type from the website, we use
        the visitor's timezone as fallback for the user's timezone """
        user = new_test_user(self.env, "test_user_1", groups="website_calendar.group_calendar_manager", email="test_user_1@nowhere.com", password="P@ssw0rd!", tz="")
        visitor = self.env['website.visitor'].create({"name": 'Test Visitor', "partner_id": user.partner_id.id})
        AppointmentType = self.env['calendar.appointment.type']
        with self.mock_visitor_from_request(force_visitor=visitor):
            # Test appointment timezone when user and visitor both don't have timezone
            AppointmentType.with_user(user).create_and_get_website_url(**{'name': 'Appointment UTC Timezone'})
            self.assertEqual(
                AppointmentType.search([
                    ('name', '=', 'Appointment UTC Timezone')
                ]).appointment_tz, 'UTC'
            )

            # Test appointment timezone when user doesn't have timezone and visitor have timezone
            visitor.timezone = 'Europe/Brussels'
            AppointmentType.with_user(user).create_and_get_website_url(**{'name': 'Appointment Visitor Timezone'})
            self.assertEqual(
                AppointmentType.search([
                    ('name', '=', 'Appointment Visitor Timezone')
                ]).appointment_tz, visitor.timezone
            )

            # Test appointment timezone when user has timezone
            user.tz = 'Asia/Calcutta'
            AppointmentType.with_user(user).create_and_get_website_url(**{'name': 'Appointment User Timezone'})
            self.assertEqual(
                AppointmentType.search([
                    ('name', '=', 'Appointment User Timezone')
                ]).appointment_tz, user.tz
            )

    def test_check_appointment_timezone(self):
        session = self.authenticate(None, None)
        odoo.http.root.session_store.save(session)
        appointment_url = self.appointment_in_brussel.website_url.rsplit("/", 1)[0]
        appointment_info_url = "%s/info?" % appointment_url
        url_inside_of_slot = appointment_info_url + url_encode({
            'employee_id': self.employee.id,
            'date_time': datetime(2023, 1, 9, 9, 0)  # 9/01/2023 is a Monday, there is a slot at 9:00
        })
        # User should be able open url without timezone session
        self.url_open(url_inside_of_slot)
