# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.utils import redirect

from odoo.addons.calendar.controllers.main import CalendarController
from odoo.http import request, route


class WebsiteCalendarController(CalendarController):

    @route(website=True)
    def view_meeting(self, token, id):
        """Redirect the user to the website page of the calendar.event,
           only if it is an appointment """
        super(WebsiteCalendarController, self).view_meeting(token, id)
        attendee = request.env['calendar.attendee'].sudo().search([
            ('access_token', '=', token),
            ('event_id', '=', int(id))])
        if not attendee:
            return request.render("website_calendar.appointment_invalid", {})

        request.session['timezone'] = attendee.partner_id.tz
        if not attendee.event_id.access_token:
            attendee.event_id._generate_access_token()
        return redirect('/calendar/view/' + str(attendee.event_id.access_token))
