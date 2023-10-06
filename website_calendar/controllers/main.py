# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta
import pytz
from babel.dates import format_datetime, format_date

from pytz.exceptions import UnknownTimeZoneError
import werkzeug.exceptions
from werkzeug.urls import url_encode

from odoo import http, _, fields
from odoo.http import request
from odoo.tools import html2plaintext, DEFAULT_SERVER_DATETIME_FORMAT as dtf
from odoo.tools.misc import get_lang


class WebsiteCalendar(http.Controller):
    @http.route([
        '/calendar',
        '/calendar/<model("calendar.appointment.type"):appointment_type>',
    ], type='http', auth="public", website=True, sitemap=True)
    def calendar_appointment_choice(self, appointment_type=None, employee_id=None, message=None, **kwargs):
        if not appointment_type:
            country_code = request.session.geoip and request.session.geoip.get('country_code')
            if country_code:
                suggested_appointment_types = request.env['calendar.appointment.type'].search([
                    '|', ('country_ids', '=', False),
                         ('country_ids.code', 'in', [country_code])])
            else:
                suggested_appointment_types = request.env['calendar.appointment.type'].search([])
            if not suggested_appointment_types:
                return request.render("website_calendar.setup", {})
            appointment_type = suggested_appointment_types[0]
        else:
            suggested_appointment_types = appointment_type
        suggested_employees = []
        if employee_id and int(employee_id) in appointment_type.sudo().employee_ids.ids:
            suggested_employees = request.env['hr.employee'].sudo().browse(int(employee_id)).name_get()
        elif appointment_type.assignation_method == 'chosen':
            suggested_employees = appointment_type.sudo().employee_ids.name_get()
        return request.render("website_calendar.index", {
            'appointment_type': appointment_type,
            'suggested_appointment_types': suggested_appointment_types,
            'message': message,
            'selected_employee_id': employee_id and int(employee_id),
            'suggested_employees': suggested_employees,
        })

    @http.route(['/calendar/get_appointment_info'], type='json', auth="public", methods=['POST'], website=True)
    def get_appointment_info(self, appointment_id, prev_emp=False, **kwargs):
        Appt = request.env['calendar.appointment.type'].browse(int(appointment_id)).sudo()
        result = {
            'message_intro': Appt.message_intro,
            'assignation_method': Appt.assignation_method,
        }
        if result['assignation_method'] == 'chosen':
            selection_template = request.env.ref('website_calendar.employee_select')
            result['employee_selection_html'] = selection_template._render({
                'appointment_type': Appt,
                'suggested_employees': Appt.employee_ids.name_get(),
                'selected_employee_id': prev_emp and int(prev_emp),
            })
        return result

    @http.route(['/calendar/<model("calendar.appointment.type"):appointment_type>/appointment'], type='http', auth="public", website=True, sitemap=True)
    def calendar_appointment(self, appointment_type=None, employee_id=None, timezone=None, failed=False, **kwargs):
        request.session['timezone'] = timezone or appointment_type.appointment_tz
        Employee = request.env['hr.employee'].sudo().browse(int(employee_id)) if employee_id else None
        Slots = appointment_type.sudo()._get_appointment_slots(request.session['timezone'], Employee)
        return request.render("website_calendar.appointment", {
            'appointment_type': appointment_type,
            'timezone': request.session['timezone'],
            'failed': failed,
            'slots': Slots,
        })

    @http.route(['/calendar/<model("calendar.appointment.type"):appointment_type>/info'], type='http', auth="public", website=True, sitemap=False)
    def calendar_appointment_form(self, appointment_type, employee_id, date_time, **kwargs):
        # check slot parameters are still valid (time, URL manipulation, ...)
        if not self._check_appointment_is_valid_slot(appointment_type, employee_id, date_time, **kwargs):
            raise werkzeug.exceptions.NotFound
        partner_data = {}
        if not request.website.is_public_user():
            partner_data = request.env.user.partner_id.read(fields=['name', 'mobile', 'country_id', 'email'])[0]
        day_name = format_datetime(datetime.strptime(date_time, dtf), 'EEE', locale=get_lang(request.env).code)
        date_formated = format_datetime(datetime.strptime(date_time, dtf), locale=get_lang(request.env).code)
        return request.render("website_calendar.appointment_form", {
            'partner_data': partner_data,
            'appointment_type': appointment_type,
            'datetime': date_time,
            'datetime_locale': day_name + ' ' + date_formated,
            'datetime_str': date_time,
            'employee_id': employee_id,
            'countries': request.env['res.country'].search([]),
        })

    @http.route(['/calendar/<model("calendar.appointment.type"):appointment_type>/submit'], type='http', auth="public", website=True, methods=["POST"])
    def calendar_appointment_submit(self, appointment_type, datetime_str, employee_id, name, phone, email, country_id=False, **kwargs):
        timezone = request.session['timezone']
        tz_session = pytz.timezone(timezone)
        date_start = tz_session.localize(fields.Datetime.from_string(datetime_str)).astimezone(pytz.utc)
        date_end = date_start + relativedelta(hours=appointment_type.appointment_duration)

        # check availability of the employee again (in case someone else booked while the client was entering the form)
        Employee = request.env['hr.employee'].sudo().browse(int(employee_id))
        if Employee.user_id and Employee.user_id.partner_id:
            if not Employee.user_id.partner_id.calendar_verify_availability(date_start, date_end):
                return request.redirect('/calendar/%s/appointment?failed=employee' % appointment_type.id)

        country_id = int(country_id) if country_id else None
        country_name = country_id and request.env['res.country'].browse(country_id).name or ''
        Partner = request.env['res.partner'].sudo().search([('email', '=like', email)], limit=1)
        if Partner:
            if not Partner.calendar_verify_availability(date_start, date_end):
                return request.redirect('/calendar/%s/appointment?failed=partner' % appointment_type.id)
            if not Partner.mobile or len(Partner.mobile) <= 5 and len(phone) > 5:
                Partner.write({'mobile': phone})
            if not Partner.country_id:
                Partner.country_id = country_id
        else:
            Partner = Partner.create({
                'name': name,
                'country_id': country_id,
                'mobile': phone,
                'email': email,
            })

        description = (_('Country: %s', country_name) + '\n' +
                      _('Mobile: %s', phone) + '\n' +
                      _('Email: %s', email) + '\n')
        for question in appointment_type.question_ids:
            key = 'question_' + str(question.id)
            if question.question_type == 'checkbox':
                answers = question.answer_ids.filtered(lambda x: (key + '_answer_' + str(x.id)) in kwargs)
                description += question.name + ': ' + ', '.join(answers.mapped('name')) + '\n'
            elif kwargs.get(key):
                if question.question_type == 'text':
                    description += '\n* ' + question.name + ' *\n' + kwargs.get(key, False) + '\n\n'
                else:
                    description += question.name + ': ' + kwargs.get(key) + '\n'

        # FIXME AWA/TDE double check this and/or write some tests to ensure behavior
        # The 'mail_notify_author' is only placed here and not in 'calendar.attendee#_send_mail_to_attendees'
        # Because we only want to notify the author in the context of Online Appointments
        # When creating a meeting from your own calendar in the backend, there is no need to notify yourself
        event = request.env['calendar.event']\
            .with_context(mail_notify_author=True, allowed_company_ids=Employee.user_id.company_ids.ids).sudo().create(
                self._prepare_calendar_values(appointment_type, date_start, date_end, description, name, Employee, Partner)
            )
        event.attendee_ids.write({'state': 'accepted'})
        return request.redirect('/calendar/view/' + event.access_token + '?message=new')

    def _check_appointment_is_valid_slot(self, appointment_type, employee_id, start_dt, **kwargs):
        """
        Given a given slot parameters check it is still valid, based on employee
        availability, slot boundaries, ...

        :param record appointment_type: an appointment.type record under which
          the appointment is about to be taken;
        :param str(int) employee_id: employee linked to the appointment slot;
        :param datetime start_dt: appointment slot starting datetime that will be
          localized in customer timezone;
        """
        if not appointment_type or not employee_id or not start_dt:
            return False

        try:
            employee = request.env['hr.employee'].sudo().search([('id', '=', int(employee_id))])
        except ValueError:
            # ValueError: the employee_id might not be a valid integer
            return False

        try:
            session_tz = request.session.get('timezone', appointment_type.appointment_tz)
            tz_info = pytz.timezone(session_tz)
            start_dt_utc = tz_info.localize(fields.Datetime.from_string(start_dt)).astimezone(pytz.utc)
        except (ValueError, UnknownTimeZoneError):
            # ValueError: the datetime may be ill-formatted
            return False

        # we shouldn't be able to book an appointment in the past
        if start_dt_utc < datetime.today().astimezone(pytz.utc):
            return False

        # the user can be a public/portal user that doesn't have read access to the appointment_type.
        appointment_type_sudo = appointment_type.sudo()

        end_dt_utc = start_dt_utc + relativedelta(hours=appointment_type_sudo.appointment_duration)
        appt_tz = pytz.timezone(appointment_type_sudo.appointment_tz)
        slots = appointment_type_sudo._slots_generate(start_dt_utc.astimezone(appt_tz), end_dt_utc.astimezone(appt_tz), session_tz)
        if not employee or employee in appointment_type_sudo.employee_ids:
            appointment_type_sudo._slots_available(slots, start_dt_utc.astimezone(pytz.UTC), end_dt_utc.astimezone(pytz.UTC), employee)
        return any(filter(lambda slot: slot.get("employee_id", False) == employee, slots))
        
    def _prepare_calendar_values(self, appointment_type, date_start, date_end, description, name, employee, partner):
        """
            prepares all values needed to create a new calendar.event
        """
        categ_id = request.env.ref('website_calendar.calendar_event_type_data_online_appointment')
        alarm_ids = appointment_type.reminder_ids and [(6, 0, appointment_type.reminder_ids.ids)] or []
        partner_ids = list(set([employee.user_id.partner_id.id] + [partner.id]))
        return {
            'name': _('%s with %s', appointment_type.name, name),
            'start': date_start.strftime(dtf),
            # FIXME master
            # we override here start_date(time) value because they are not properly
            # recomputed due to ugly overrides in event.calendar (reccurrencies suck!)
            #     (fixing them in stable is a pita as it requires a good rewrite of the
            #      calendar engine)
            'start_date': date_start.strftime(dtf),
            'stop': date_end.strftime(dtf),
            'allday': False,
            'duration': appointment_type.appointment_duration,
            'description': description,
            'alarm_ids': alarm_ids,
            'location': appointment_type.location,
            'partner_ids': [(4, pid, False) for pid in partner_ids],
            'categ_ids': [(4, categ_id.id, False)],
            'appointment_type_id': appointment_type.id,
            'user_id': employee.user_id.id,
        }

    @http.route(['/calendar/view/<string:access_token>'], type='http', auth="public", website=True)
    def calendar_appointment_view(self, access_token, edit=False, message=False, **kwargs):
        event = request.env['calendar.event'].sudo().search([('access_token', '=', access_token)], limit=1)
        if not event:
            return request.not_found()
        timezone = request.session.get('timezone')
        if not timezone:
            timezone = request.env.context.get('tz') or event.appointment_type_id.appointment_tz or event.partner_ids and event.partner_ids[0].tz or event.user_id.tz or 'UTC'
            request.session['timezone'] = timezone
        tz_session = pytz.timezone(timezone)

        date_start_suffix = ""
        format_func = format_datetime
        if not event.allday:
            url_date_start = fields.Datetime.from_string(event.start).strftime('%Y%m%dT%H%M%SZ')
            url_date_stop = fields.Datetime.from_string(event.stop).strftime('%Y%m%dT%H%M%SZ')
            date_start = fields.Datetime.from_string(event.start).replace(tzinfo=pytz.utc).astimezone(tz_session)
        else:
            url_date_start = url_date_stop = fields.Date.from_string(event.start_date).strftime('%Y%m%d')
            date_start = fields.Date.from_string(event.start_date)
            format_func = format_date
            date_start_suffix = _(', All Day')

        locale = get_lang(request.env).code
        day_name = format_func(date_start, 'EEE', locale=locale)
        date_start = day_name + ' ' + format_func(date_start, locale=locale) + date_start_suffix
        details = event.appointment_type_id and event.appointment_type_id.message_confirmation or event.description or ''
        params = {
            'action': 'TEMPLATE',
            'text': event.name,
            'dates': url_date_start + '/' + url_date_stop,
            'details': html2plaintext(details.encode('utf-8'))
        }
        if event.location:
            params.update(location=event.location.replace('\n', ' '))
        encoded_params = url_encode(params)
        google_url = 'https://www.google.com/calendar/render?' + encoded_params

        return request.render("website_calendar.appointment_validated", {
            'event': event,
            'datetime_start': date_start,
            'google_url': google_url,
            'message': message,
            'edit': edit,
        })

    @http.route(['/calendar/cancel/<string:access_token>'], type='http', auth="public", website=True)
    def calendar_appointment_cancel(self, access_token, **kwargs):
        event = request.env['calendar.event'].sudo().search([('access_token', '=', access_token)], limit=1)
        if not event:
            return request.not_found()
        if fields.Datetime.from_string(event.allday and event.start_date or event.start) < datetime.now() + relativedelta(hours=event.appointment_type_id.min_cancellation_hours):
            return request.redirect('/calendar/view/' + access_token + '?message=no-cancel')
        event.with_context(archive_on_error=True).unlink()
        return request.redirect('/calendar?message=cancel')

    @http.route(['/calendar/ics/<string:access_token>.ics'], type='http', auth="public", website=True)
    def calendar_appointment_ics(self, access_token, **kwargs):
        event = request.env['calendar.event'].sudo().search([('access_token', '=', access_token)], limit=1)
        if not event or not event.attendee_ids:
            return request.not_found()
        files = event._get_ics_file()
        content = files[event.id]
        return request.make_response(content, [
            ('Content-Type', 'application/octet-stream'),
            ('Content-Length', len(content)),
            ('Content-Disposition', 'attachment; filename=Appoinment.ics')
        ])
