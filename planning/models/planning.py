# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval
from datetime import date, datetime, timedelta, time
from dateutil.relativedelta import relativedelta
from dateutil.rrule import rrule, DAILY
import json
import logging
import pytz
import uuid
from math import ceil, modf

from odoo import api, fields, models, _
from odoo.exceptions import UserError, AccessError
from odoo.osv import expression
from odoo.tools import format_time
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from odoo.tools.misc import format_date, format_datetime

_logger = logging.getLogger(__name__)


def days_span(start_datetime, end_datetime):
    if not isinstance(start_datetime, datetime):
        raise ValueError
    if not isinstance(end_datetime, datetime):
        raise ValueError
    end = datetime.combine(end_datetime, datetime.min.time())
    start = datetime.combine(start_datetime, datetime.min.time())
    duration = end - start
    return duration.days + 1


class Planning(models.Model):
    _name = 'planning.slot'
    _description = 'Planning Shift'
    _order = 'start_datetime,id desc'
    _rec_name = 'name'
    _check_company_auto = True

    def _default_start_datetime(self):
        return datetime.combine(fields.Date.context_today(self), time.min)

    def _default_end_datetime(self):
        return datetime.combine(fields.Date.context_today(self), time.max)

    name = fields.Text('Note')
    employee_id = fields.Many2one('hr.employee', "Employee", group_expand='_read_group_employee_id')
    work_email = fields.Char("Work Email", related='employee_id.work_email')
    department_id = fields.Many2one(related='employee_id.department_id', store=True)
    user_id = fields.Many2one('res.users', string="User", related='employee_id.user_id', store=True, readonly=True)
    manager_id = fields.Many2one(related='employee_id.parent_id')
    company_id = fields.Many2one('res.company', string="Company", required=True, compute="_compute_planning_slot_company_id", store=True, readonly=False)
    role_id = fields.Many2one('planning.role', string="Role", compute="_compute_role_id", store=True, readonly=False, copy=True, group_expand='_read_group_role_id')
    color = fields.Integer("Color", related='role_id.color')
    was_copied = fields.Boolean("This Shift Was Copied From Previous Week", default=False, readonly=True)
    access_token = fields.Char("Security Token", default=lambda self: str(uuid.uuid4()), required=True, copy=False, readonly=True)

    start_datetime = fields.Datetime(
        "Start Date", compute='_compute_datetime', store=True, readonly=False, required=True,
        copy=True, default=_default_start_datetime)
    end_datetime = fields.Datetime(
        "End Date", compute='_compute_datetime', store=True, readonly=False, required=True,
        copy=True, default=_default_end_datetime)
    # UI fields and warnings
    allow_self_unassign = fields.Boolean('Let Employee Unassign Themselves', related='company_id.planning_allow_self_unassign')
    is_assigned_to_me = fields.Boolean('Is This Shift Assigned To The Current User', compute='_compute_is_assigned_to_me')
    overlap_slot_count = fields.Integer('Overlapping Slots', compute='_compute_overlap_slot_count')
    is_past = fields.Boolean('Is This Shift In The Past?', compute='_compute_past_shift')

    # time allocation
    allocation_type = fields.Selection([
        ('planning', 'Planning'),
        ('forecast', 'Forecast')
    ], compute='_compute_allocation_type')
    allocated_hours = fields.Float("Allocated Hours", compute='_compute_allocated_hours', store=True, readonly=False)
    allocated_percentage = fields.Float("Allocated Time (%)", default=100,
        compute='_compute_allocated_percentage', store=True, readonly=False,
        help="Percentage of time the employee is supposed to work during the shift.",
        group_operator="avg")
    working_days_count = fields.Integer("Number of Working Days", compute='_compute_working_days_count', store=True)

    # publication and sending
    is_published = fields.Boolean("Is The Shift Sent", default=False, readonly=True, help="If checked, this means the planning entry has been sent to the employee. Modifying the planning entry will mark it as not sent.", copy=False)
    publication_warning = fields.Boolean(
        "Modified Since Last Publication", default=False, compute='_compute_publication_warning',
        store=True, readonly=True, copy=False,
        help="If checked, it means that the shift contains has changed since its last publish.")
    # template dummy fields (only for UI purpose)
    template_autocomplete_ids = fields.Many2many('planning.slot.template', store=False, compute='_compute_template_autocomplete_ids')
    template_id = fields.Many2one('planning.slot.template', string='Shift Templates', compute='_compute_template_id', readonly=False, store=True)
    template_reset = fields.Boolean()
    previous_template_id = fields.Many2one('planning.slot.template')
    allow_template_creation = fields.Boolean(string='Allow Template Creation', compute='_compute_allow_template_creation')

    # Recurring (`repeat_` fields are none stored, only used for UI purpose)
    recurrency_id = fields.Many2one('planning.recurrency', readonly=True, index=True, ondelete="set null", copy=False)
    repeat = fields.Boolean("Repeat", compute='_compute_repeat', inverse='_inverse_repeat')
    repeat_interval = fields.Integer("Repeat every", default=1, compute='_compute_repeat_interval', inverse='_inverse_repeat')
    repeat_type = fields.Selection([('forever', 'Forever'), ('until', 'Until')], string='Repeat Type', default='forever', compute='_compute_repeat_type', inverse='_inverse_repeat')
    repeat_until = fields.Date("Repeat Until", compute='_compute_repeat_until', inverse='_inverse_repeat', help="If set, the recurrence stop at that date. Otherwise, the recurrence is applied indefinitely.")
    confirm_delete = fields.Boolean('Confirm Slots Deletion', compute='_compute_confirm_delete')

    _sql_constraints = [
        ('check_start_date_lower_end_date', 'CHECK(end_datetime > start_datetime)', 'Shift end date should be greater than its start date'),
        ('check_allocated_hours_positive', 'CHECK(allocated_hours >= 0)', 'You cannot have negative shift'),
    ]

    @api.depends('repeat_until')
    def _compute_confirm_delete(self):
        for slot in self:
            if slot.recurrency_id and slot.repeat_until:
                slot.confirm_delete = fields.Date.to_date(slot.recurrency_id.repeat_until) > slot.repeat_until if slot.recurrency_id.repeat_until else True
            else:
                slot.confirm_delete = False

    @api.constrains('repeat_until')
    def _check_repeat_until(self):
        if any([slot.repeat_until and slot.repeat_until < slot.start_datetime.date() for slot in self]):
            raise UserError(_('The recurrence until date should be after the shift start date')) 

    @api.onchange('repeat_until')
    def _onchange_repeat_until(self):
        self._check_repeat_until()

    @api.depends('employee_id.company_id')
    def _compute_planning_slot_company_id(self):
        for slot in self:
            if slot.employee_id:
                slot.company_id = slot.employee_id.company_id.id
            if not slot.company_id.id:
                slot.company_id = slot.env.company

    @api.depends('start_datetime')
    def _compute_past_shift(self):
        now = fields.Datetime.now()
        for slot in self:
            slot.is_past = slot.end_datetime < now if slot.end_datetime else False

    @api.depends('employee_id', 'template_id')
    def _compute_role_id(self):
        for slot in self:
            if not slot.role_id:
                if slot.employee_id.default_planning_role_id:
                    slot.role_id = slot.employee_id.default_planning_role_id
                else:
                    slot.role_id = False

            if slot.template_id:
                slot.previous_template_id = slot.template_id
                if slot.template_id.role_id:
                    slot.role_id = slot.template_id.role_id
            elif slot.previous_template_id and not slot.template_id and slot.previous_template_id.role_id == slot.role_id:
                slot.role_id = False

    @api.depends('user_id')
    def _compute_is_assigned_to_me(self):
        for slot in self:
            slot.is_assigned_to_me = slot.user_id == self.env.user

    @api.depends('start_datetime', 'end_datetime')
    def _compute_allocation_type(self):
        for slot in self:
            if slot.start_datetime and slot.end_datetime and slot._get_slot_duration() < 24:
                slot.allocation_type = 'planning'
            else:
                slot.allocation_type = 'forecast'

    @api.depends('start_datetime', 'end_datetime', 'employee_id.resource_calendar_id', 'allocated_hours')
    def _compute_allocated_percentage(self):
        for slot in self:
            if slot.start_datetime and slot.end_datetime and slot.start_datetime != slot.end_datetime:
                if slot.allocation_type == 'planning':
                    slot.allocated_percentage = 100 * slot.allocated_hours / slot._get_slot_duration()
                else:
                    if slot.employee_id:
                        work_hours = slot.employee_id._get_work_days_data_batch(slot.start_datetime, slot.end_datetime, compute_leaves=True)[slot.employee_id.id]['hours']
                        slot.allocated_percentage = 100 * slot.allocated_hours / work_hours if work_hours else 100
                    else:
                        slot.allocated_percentage = 100

    @api.depends(
        'start_datetime', 'end_datetime', 'employee_id.resource_calendar_id',
        'company_id.resource_calendar_id', 'allocated_percentage')
    def _compute_allocated_hours(self):
        percentage_field = self._fields['allocated_percentage']
        self.env.remove_to_compute(percentage_field, self)
        for slot in self:
            if slot.start_datetime and slot.end_datetime:
                ratio = slot.allocated_percentage / 100.0
                if slot.allocation_type == 'planning':
                    slot.allocated_hours = slot._get_slot_duration() * ratio
                else:
                    calendar = slot.employee_id.resource_calendar_id or slot.company_id.resource_calendar_id
                    hours = calendar.get_work_hours_count(slot.start_datetime, slot.end_datetime) if calendar else slot._get_slot_duration()
                    slot.allocated_hours = hours * ratio
            else:
                slot.allocated_hours = 0.0

    @api.depends('start_datetime', 'end_datetime', 'employee_id')
    def _compute_working_days_count(self):
        for slot in self:
            if slot.employee_id:
                slot.working_days_count = ceil(slot.employee_id._get_work_days_data_batch(
                    slot.start_datetime, slot.end_datetime, compute_leaves=True
                )[slot.employee_id.id]['days'])
            else:
                slot.working_days_count = 0

    @api.depends('start_datetime', 'end_datetime', 'employee_id')
    def _compute_overlap_slot_count(self):
        if self.ids:
            self.flush(['start_datetime', 'end_datetime', 'employee_id'])
            query = """
                SELECT S1.id,count(*) FROM
                    planning_slot S1, planning_slot S2
                WHERE
                    S1.start_datetime < S2.end_datetime and S1.end_datetime > S2.start_datetime and S1.id <> S2.id and S1.employee_id = S2.employee_id
                    and S1.id in %s
                GROUP BY S1.id;
            """
            self.env.cr.execute(query, (tuple(self.ids),))
            overlap_mapping = dict(self.env.cr.fetchall())
            for slot in self:
                slot.overlap_slot_count = overlap_mapping.get(slot.id, 0)
        else:
            self.overlap_slot_count = 0

    def _get_slot_duration(self):
        """Return the slot (effective) duration expressed in hours.
        """
        self.ensure_one()
        return (self.end_datetime - self.start_datetime).total_seconds() / 3600.0

    def _get_domain_template_slots(self):
        domain = ['|', ('company_id', '=', self.company_id.id), ('company_id', '=', False)]
        if self.role_id:
            domain += ['|', ('role_id', '=', self.role_id.id), ('role_id', '=', False)]
        elif self.employee_id and self.employee_id.sudo().planning_role_ids:
            domain += ['|', ('role_id', 'in', self.employee_id.sudo().planning_role_ids.ids), ('role_id', '=', False)]
        return domain

    @api.depends('role_id', 'employee_id')
    def _compute_template_autocomplete_ids(self):
        domain = self._get_domain_template_slots()
        templates = self.env['planning.slot.template'].search(domain, order='start_time', limit=10)
        self.template_autocomplete_ids = templates + self.template_id

    @api.depends('employee_id', 'role_id', 'start_datetime', 'allocated_hours')
    def _compute_template_id(self):
        for slot in self.filtered(lambda s: s.template_id):
            slot.previous_template_id = slot.template_id
            slot.template_reset = False
            if slot._different_than_template():
                slot.template_id = False
                slot.previous_template_id = False
                slot.template_reset = True

    def _different_than_template(self, check_empty=True):
        self.ensure_one()
        template_fields = self._get_template_fields().items()
        for template_field, slot_field in template_fields:
            if self.template_id[template_field] or not check_empty:
                if template_field == 'start_time':
                    h = int(self.template_id.start_time)
                    m = round(modf(self.template_id.start_time)[0] * 60.0)
                    slot_time = self[slot_field].astimezone(pytz.timezone(self._get_tz()))
                    if slot_time.hour != h or slot_time.minute != m:
                        return True
                else:
                    if self[slot_field] != self.template_id[template_field]:
                        return True
        return False

    @api.depends('template_id', 'role_id', 'allocated_hours')
    def _compute_allow_template_creation(self):
        for slot in self:
            if not (slot.start_datetime and slot.end_datetime):
                slot.allow_template_creation = False
                continue
            
            values = self._prepare_template_values()
            domain = [(x, '=', values[x]) for x in values.keys()]
            existing_templates = self.env['planning.slot.template'].search(domain, limit=1)
            slot.allow_template_creation = not existing_templates and slot._different_than_template(check_empty=False)

    @api.depends('recurrency_id')
    def _compute_repeat(self):
        for slot in self:
            if slot.recurrency_id:
                slot.repeat = True
            else:
                slot.repeat = False

    @api.depends('recurrency_id.repeat_interval')
    def _compute_repeat_interval(self):
        for slot in self:
            if slot.recurrency_id:
                slot.repeat_interval = slot.recurrency_id.repeat_interval
            else:
                slot.repeat_interval = False

    @api.depends('recurrency_id.repeat_until')
    def _compute_repeat_until(self):
        for slot in self:
            if slot.recurrency_id:
                slot.repeat_until = slot.recurrency_id.repeat_until
            else:
                slot.repeat_until = False

    @api.depends('recurrency_id.repeat_type')
    def _compute_repeat_type(self):
        for slot in self:
            if slot.recurrency_id:
                slot.repeat_type = slot.recurrency_id.repeat_type
            else:
                slot.repeat_type = False

    def _inverse_repeat(self):
        for slot in self:
            if slot.repeat and not slot.recurrency_id.id:  # create the recurrence
                repeat_until = False
                if slot.repeat_type == "until":
                    repeat_until = datetime.combine(fields.Date.to_date(slot.repeat_until), datetime.max.time())
                    repeat_until = repeat_until.replace(tzinfo=pytz.timezone(slot.company_id.resource_calendar_id.tz or 'UTC')).astimezone(pytz.utc).replace(tzinfo=None)
                recurrency_values = {
                    'repeat_interval': slot.repeat_interval,
                    'repeat_until': repeat_until,
                    'repeat_type': slot.repeat_type,
                    'company_id': slot.company_id.id,
                }
                recurrence = self.env['planning.recurrency'].create(recurrency_values)
                slot.recurrency_id = recurrence
                slot.recurrency_id._repeat_slot()
            # user wants to delete the recurrence
            # here we also check that we don't delete by mistake a slot of which the repeat parameters have been changed
            elif not slot.repeat and slot.recurrency_id.id and (
                slot.repeat_type == slot.recurrency_id.repeat_type and
                slot.repeat_until == slot.recurrency_id.repeat_until and
                slot.repeat_interval == slot.recurrency_id.repeat_interval
            ):
                slot.recurrency_id._delete_slot(slot.end_datetime)
                slot.recurrency_id.unlink()  # will set recurrency_id to NULL

    @api.model
    def _calculate_start_end_dates(self,
                                 start_datetime,
                                 end_datetime,
                                 employee_id,
                                 template_id,
                                 previous_template_id,
                                 template_reset):

        def convert_datetime_timezone(dt, tz):
            return dt and pytz.utc.localize(dt).astimezone(tz)

        user_tz = pytz.timezone(self._get_tz())
        employee = employee_id if employee_id else self.env.user.employee_id

        # start_datetime and end_datetime are from 00:00 to 23:59 in user timezone
        # Converted in UTC, it gives an offset for any other timezone, _convert_datetime_timezone removes the offset
        start = convert_datetime_timezone(start_datetime, user_tz) if start_datetime else user_tz.localize(self._default_start_datetime())
        end = convert_datetime_timezone(end_datetime, user_tz) if end_datetime else user_tz.localize(self._default_end_datetime())

        # Get start and end in employee timezone so that it begins/ends at the same hour of the day as it would be in the user timezone
        # This is needed because _adjust_to_calendar takes start as datetime for the start of the day and end as end time for the end of the day
        # This can lead to different results depending on the timezone difference between the current user and the employee.
        # Example:
        # The user is in Europe/Brussels timezone (CET, UTC+1)
        # The employee is Asia/Krasnoyarsk timezone (IST, UTC+7)
        # The employee has two shifts during the day:
        #       - Morning shift: 8 to 12
        #       - Afternoon shift: 13 to 17
        # When the user selects a day to plan a shift for the employee, he expects to have the shift scheduled according to the resource's calendar given a search range between 00:00 and 23:59
        # The datetime received from the frontend is in the user's timezone meaning that the search interval will be between 23:00 and 22:59 in UTC
        # If the datetime is not adjusted to the resource's calendar beforehand, _adjust_to_calendar and _get_closest_work_time will shift the time to the resource's timezone.
        # The datetime given to _get_closest_work_time will be 6 AM once shifted in the resource's timezone. This will properly find the start of the morning shift at 8AM
        # For the afternoon shift, _get_closest_work_time will search the end of the shift that is close to 6AM the day after.
        # The closest shift found based on the end datetime will be the morning shift meaning that the work_interval_end will be the end of the morning shift the following day.
        if employee:
            work_interval_start, work_interval_end = employee._adjust_to_calendar(start.replace(tzinfo=pytz.timezone(employee.tz)), end.replace(tzinfo=pytz.timezone(employee.tz)))[employee]
            start, end = (work_interval_start or start, work_interval_end or end)

        if not previous_template_id and not template_reset:
            start = start.astimezone(pytz.utc).replace(tzinfo=None)
            end = end.astimezone(pytz.utc).replace(tzinfo=None)

        if template_id and start_datetime:
            h = int(template_id.start_time)
            m = round(modf(template_id.start_time)[0] * 60.0)
            start = pytz.utc.localize(start_datetime).astimezone(pytz.timezone(employee.tz) if
                                                                 employee else user_tz)
            start = start.replace(hour=int(h), minute=int(m))
            start = start.astimezone(pytz.utc).replace(tzinfo=None)

            h, m = divmod(template_id.duration, 1)
            delta = timedelta(hours=int(h), minutes=int(m * 60))
            end = start + delta
        return (start, end)

    @api.depends('template_id')
    def _compute_datetime(self):
        for slot in self.filtered(lambda s: s.template_id):
            slot.start_datetime, slot.end_datetime = self._calculate_start_end_dates(slot.start_datetime,
                                                                                     slot.end_datetime,
                                                                                     slot.employee_id,
                                                                                     slot.template_id,
                                                                                     slot.previous_template_id,
                                                                                     slot.template_reset)

    @api.depends('start_datetime', 'end_datetime', 'employee_id')
    def _compute_publication_warning(self):
        with_warning = self.filtered(lambda t: t.employee_id and t.is_published)
        with_warning.update({'publication_warning': True})

    def _company_working_hours(self, start, end):
        company = self.company_id or self.env.company
        work_interval = company.resource_calendar_id._work_intervals(start, end)
        intervals = [(start, stop) for start, stop, attendance in work_interval]
        start_datetime, end_datetime = (intervals[0][0], intervals[-1][-1]) if intervals else (start, end)

        return (start_datetime, end_datetime)
    # ----------------------------------------------------
    # ORM overrides
    # ----------------------------------------------------

    @api.model
    def default_get(self, fields_list):
        res = super(Planning, self).default_get(fields_list)

        if res.get('employee_id'):
            employee_id = self.env['hr.employee'].browse(res.get('employee_id'))
            template_id, previous_template_id = [res.get(key) for key in ['template_id', 'previous_template_id']]
            template_id = template_id and self.env['planning.slot.template'].browse(template_id)
            previous_template_id = template_id and self.env['planning.slot.template'].browse(previous_template_id)
            res['start_datetime'], res['end_datetime'] = self._calculate_start_end_dates(res.get('start_datetime'),
                                                                                       res.get('end_datetime'),
                                                                                       employee_id,
                                                                                       template_id,
                                                                                       previous_template_id,
                                                                                       res.get('template_reset'))
        else:
            if 'start_datetime' in fields_list:
                start_datetime = fields.Datetime.from_string(res.get('start_datetime'))
                end_datetime = fields.Datetime.from_string(res.get('end_datetime')) if res.get('end_datetime') else False
                start = pytz.utc.localize(start_datetime)
                end = pytz.utc.localize(end_datetime) if end_datetime else self._default_end_datetime()
                opening_hours = self._company_working_hours(start, end)
                res['start_datetime'] = opening_hours[0].astimezone(pytz.utc).replace(tzinfo=None)

                if 'end_datetime' in fields_list:
                    res['end_datetime'] = opening_hours[1].astimezone(pytz.utc).replace(tzinfo=None)

        return res

    def _init_column(self, column_name):
        """ Initialize the value of the given column for existing rows.
            Overridden here because we need to generate different access tokens
            and by default _init_column calls the default method once and applies
            it for every record.
        """
        if column_name != 'access_token':
            super(Planning, self)._init_column(column_name)
        else:
            query = """
                UPDATE %(table_name)s
                SET access_token = md5(md5(random()::varchar || id::varchar) || clock_timestamp()::varchar)::uuid::varchar
                WHERE access_token IS NULL
            """ % {'table_name': self._table}
            self.env.cr.execute(query)

    def name_get(self):
        group_by = self.env.context.get('group_by', [])
        field_list = [fname for fname in self._name_get_fields() if fname not in group_by]
        is_calendar = self.env.context.get('planning_calendar_view', False)
        if is_calendar and self.env.context.get('planning_hide_employee', False):
            field_list.remove('employee_id')

        # Sudo as a planning manager is not able to read private project if he is not project manager.
        self = self.sudo()
        result = []
        for slot in self:
            # label part, depending on context `groupby`
            name = ' - '.join([self._fields[fname].convert_to_display_name(slot[fname], slot) for fname in field_list if slot[fname]][:3])  # limit to 3 labels

            # add unicode bubble to tell there is a note
            if slot.name:
                name = u'%s \U0001F4AC' % name

            result.append([slot.id, name])
        return result

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('company_id') and vals.get('employee_id'):
                vals['company_id'] = self.env['hr.employee'].browse(vals.get('employee_id')).company_id.id
            if not vals.get('company_id'):
                vals['company_id'] = self.env.company.id
        return super().create(vals_list)

    def write(self, values):
        # detach planning entry from recurrency
        if any(fname in values.keys() for fname in self._get_fields_breaking_recurrency()) and not values.get('recurrency_id'):
            values.update({'recurrency_id': False})
        # warning on published shifts
        if 'publication_warning' not in values and (set(values.keys()) & set(self._get_fields_breaking_publication())):
            values['publication_warning'] = True
        result = super(Planning, self).write(values)
        # recurrence
        if any(key in ('repeat', 'repeat_type', 'repeat_until', 'repeat_interval') for key in values):
            # User is trying to change this record's recurrence so we delete future slots belonging to recurrence A
            # and we create recurrence B from now on w/ the new parameters
            for slot in self:
                if slot.recurrency_id and values.get('repeat') is None:
                    repeat_type = values.get('repeat_type') or slot.recurrency_id.repeat_type
                    repeat_until = values.get('repeat_until') or slot.recurrency_id.repeat_until
                    if repeat_type == 'until':
                        repeat_until = datetime.combine(fields.Date.to_date(repeat_until), datetime.max.time())
                        repeat_until = repeat_until.replace(tzinfo=pytz.timezone(slot.company_id.resource_calendar_id.tz or 'UTC')).astimezone(pytz.utc).replace(tzinfo=None)
                    recurrency_values = {
                        'repeat_interval': values.get('repeat_interval') or slot.recurrency_id.repeat_interval,
                        'repeat_until': repeat_until if repeat_type == 'until' else False,
                        'repeat_type': repeat_type,
                        'company_id': slot.company_id.id,
                    }
                    slot.recurrency_id.write(recurrency_values)
                    slot.recurrency_id._delete_slot(recurrency_values.get('repeat_until'))
                    slot.recurrency_id._repeat_slot()
        return result

    # ----------------------------------------------------
    # Actions
    # ----------------------------------------------------

    def action_unlink(self):
        self.unlink()
        return {'type': 'ir.actions.act_window_close'}

    def action_see_overlaping_slots(self):
        domain_map = self._get_overlap_domain()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'planning.slot',
            'name': _('Shifts in conflict'),
            'view_mode': 'gantt,list,form',
            'domain': domain_map[self.id],
            'context': {
                'initialDate': min([slot.start_datetime for slot in self.search(domain_map[self.id])])
            }
        }

    def action_open_employee_form(self):
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.employee',
            'res_id': self.employee_id.id,
            'target': 'new',
            'view_mode': 'form'
        }

    def action_self_assign(self):
        """ Allow planning user to self assign open shift. """
        self.ensure_one()
        # user must at least 'read' the shift to self assign (Prevent any user in the system (portal, ...) to assign themselves)
        if not self.check_access_rights('read', raise_exception=False):
            raise AccessError(_("You don't the right to self assign."))
        if self.employee_id:
            raise UserError(_("You can not assign yourself to an already assigned shift."))
        return self.sudo().write({'employee_id': self.env.user.employee_id.id if self.env.user.employee_id else False})

    def action_self_unassign(self):
        """ Allow planning user to self unassign from a shift, if the feature is activated """
        self.ensure_one()
        # The following condition will check the read access on planning.slot, and that user must at least 'read' the
        # shift to self unassign. Prevent any user in the system (portal, ...) to unassign any shift.
        if not self.allow_self_unassign:
            raise UserError(_("The company does not allow you to self unassign."))
        if self.employee_id != self.env.user.employee_id:
            raise UserError(_("You can not unassign another employee than yourself."))
        return self.sudo().write({'employee_id': False})

    def action_create_template(self):
        values = self._prepare_template_values()
        domain = [(x, '=', values[x]) for x in values.keys()]
        existing_templates = self.env['planning.slot.template'].search(domain, limit=1)
        if not existing_templates:
            template = self.env['planning.slot.template'].create(values)
            self.write({'template_id': template.id, 'previous_template_id': template.id})
            message = _("Your template was successfully saved.")
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'message': message,
                    'type': 'success',
                    'sticky': False,
                }
            }
        else:
            self.write({'template_id': existing_templates.id})

    # ----------------------------------------------------
    # Gantt - Calendar view
    # ----------------------------------------------------

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None, rows=None):
        start_datetime = fields.Datetime.from_string(start_date)
        end_datetime = fields.Datetime.from_string(end_date)
        employee_ids = set()

        # function to "mark" top level rows concerning employees
        # the propagation of that item to subrows is taken care of in the traverse function below
        def tag_employee_rows(rows):
            for row in rows:
                group_bys = row.get('groupedBy')
                res_id = row.get('resId')
                if group_bys:
                    # if employee_id is the first grouping attribute, we mark the row
                    if group_bys[0] == 'employee_id' and res_id:
                        employee_id = res_id
                        employee_ids.add(employee_id)
                        row['employee_id'] = employee_id
                    # else we recursively traverse the rows where employee_id appears in the group_by
                    elif 'employee_id' in group_bys:
                        tag_employee_rows(row.get('rows'))

        tag_employee_rows(rows)
        employees = self.env['hr.employee'].browse(employee_ids)
        leaves_mapping = employees.mapped('resource_id')._get_unavailable_intervals(start_datetime, end_datetime)
        company_leaves = self.env.company.resource_calendar_id._unavailable_intervals(start_datetime.replace(tzinfo=pytz.utc), end_datetime.replace(tzinfo=pytz.utc))

        # function to recursively replace subrows with the ones returned by func
        def traverse(func, row):
            new_row = dict(row)
            if new_row.get('employee_id'):
                for sub_row in new_row.get('rows'):
                    sub_row['employee_id'] = new_row['employee_id']
            new_row['rows'] = [traverse(func, row) for row in new_row.get('rows')]
            return func(new_row)

        cell_dt = timedelta(hours=1) if scale in ['day', 'week'] else timedelta(hours=12)

        # for a single row, inject unavailability data
        def inject_unavailability(row):
            new_row = dict(row)

            calendar = company_leaves
            if row.get('employee_id'):
                employee_id = self.env['hr.employee'].browse(row.get('employee_id'))
                if employee_id:
                    calendar = leaves_mapping[employee_id.resource_id.id]

            # remove intervals smaller than a cell, as they will cause half a cell to turn grey
            # ie: when looking at a week, a employee start everyday at 8, so there is a unavailability
            # like: 2019-05-22 20:00 -> 2019-05-23 08:00 which will make the first half of the 23's cell grey
            notable_intervals = filter(lambda interval: interval[1] - interval[0] >= cell_dt, calendar)
            new_row['unavailabilities'] = [{'start': interval[0], 'stop': interval[1]} for interval in notable_intervals]
            return new_row

        return [traverse(inject_unavailability, row) for row in rows]

    @api.model
    def get_unusual_days(self, date_from, date_to=None):
        # Checking the calendar directly allows to not grey out the leaves taken
        # by the employee
        employee = self.env.user.employee_id
        calendar = employee.resource_calendar_id
        if not calendar:
            return {}
        dfrom = datetime.combine(fields.Date.from_string(date_from), time.min).replace(tzinfo=pytz.utc)
        dto = datetime.combine(fields.Date.from_string(date_to), time.max).replace(tzinfo=pytz.utc)

        works = {d[0].date() for d in calendar._work_intervals_batch(dfrom, dto, employee.resource_id)[employee.resource_id.id]}
        return {fields.Date.to_string(day.date()): (day.date() not in works) for day in rrule(DAILY, dfrom, until=dto)}


    # ----------------------------------------------------
    # Period Duplication
    # ----------------------------------------------------

    @api.model
    def action_copy_previous_week(self, date_start_week, view_domain):
        date_end_copy = datetime.strptime(date_start_week, DEFAULT_SERVER_DATETIME_FORMAT)
        date_start_copy = date_end_copy - relativedelta(days=7)
        domain = [
            ('recurrency_id', '=', False),
            ('was_copied', '=', False)
        ]
        for dom in view_domain:
            if dom in ['|', '&', '!']:
                domain.append(dom)
            elif dom[0] == 'start_datetime':
                domain.append(('start_datetime', '>=', date_start_copy))
            elif dom[0] == 'end_datetime':
                domain.append(('end_datetime', '<=', date_end_copy))
            else:
                domain.append(tuple(dom))
        slots_to_copy = self.search(domain)

        new_slot_values = []
        for slot in slots_to_copy:
            if not slot.was_copied:
                values = slot.copy_data()[0]
                if values.get('start_datetime'):
                    values['start_datetime'] = self._add_delta_with_dst(values['start_datetime'], relativedelta(days=7))
                if values.get('end_datetime'):
                    values['end_datetime'] = self._add_delta_with_dst(values['end_datetime'], relativedelta(days=7))
                values['is_published'] = False
                new_slot_values.append(values)
        slots_to_copy.write({'was_copied': True})
        return self.create(new_slot_values)

    # ----------------------------------------------------
    # Sending Shifts
    # ----------------------------------------------------

    def action_send(self):
        self.ensure_one()
        if not self.employee_id or not self.employee_id.work_email:
            self.is_published = True
            domain = [('company_id', '=', self.company_id.id), ('work_email', '!=', False)]
            if self.role_id:
                domain = expression.AND([
                    domain,
                    ['|', ('planning_role_ids', '=', False), ('planning_role_ids', 'in', self.role_id.id)]])
            employee_ids = self.env['hr.employee'].sudo().search(domain)
            return self._send_slot(employee_ids, self.start_datetime, self.end_datetime)
        self._send_slot(self.employee_id, self.start_datetime, self.end_datetime)
        return True

    def action_publish(self):
        self.write({
            'is_published': True,
            'publication_warning': False,
        })
        return True

    # ----------------------------------------------------
    # Business Methods
    # ----------------------------------------------------
    def _add_delta_with_dst(self, start, delta):
        """
        Add to start, adjusting the hours if needed to account for a shift in the local timezone between the
        start date and the resulting date (typically, because of DST)

        :param start: origin date in UTC timezone, but without timezone info (a naive date)
        :return resulting date in the UTC timezone (a naive date)
        """
        try:
            tz = pytz.timezone(self._get_tz())
        except pytz.UnknownTimeZoneError:
            tz = pytz.UTC
        start = start.replace(tzinfo=pytz.utc).astimezone(tz).replace(tzinfo=None)
        result = start + delta
        return tz.localize(result).astimezone(pytz.utc).replace(tzinfo=None)

    def _name_get_fields(self):
        """ List of fields that can be displayed in the name_get """
        return ['employee_id', 'role_id']

    def _get_fields_breaking_publication(self):
        """ Fields list triggering the `publication_warning` to True when updating shifts """
        return [
            'employee_id',
            'start_datetime',
            'end_datetime',
            'role_id',
        ]

    def _get_fields_breaking_recurrency(self):
        """Returns the list of field which when changed should break the relation of the forecast
            with it's recurrency
        """
        return [
            'employee_id',
            'role_id',
        ]

    @api.model
    def _get_template_fields(self):
        # key -> field from template
        # value -> field from slot
        return {'role_id': 'role_id', 'start_time': 'start_datetime'}

    def _get_tz(self):
        return (self.env.user.tz
                or self.employee_id.tz
                or self._context.get('tz')
                or self.company_id.resource_calendar_id.tz
                or 'UTC')

    def _get_overlap_domain(self):
        """ get overlapping domain for current shifts
            :returns dict : map with slot id as key and domain as value
        """
        domain_mapping = {}
        for slot in self:
            domain_mapping[slot.id] = [
                '&',
                    '&',
                        ('employee_id', '!=', False),
                        ('employee_id', '=', slot.employee_id.id),
                    '&',
                        ('start_datetime', '<', slot.end_datetime),
                        ('end_datetime', '>', slot.start_datetime)
            ]
        return domain_mapping

    def _prepare_template_values(self):
        """ extract values from shift to create a template """
        # compute duration w/ tzinfo otherwise DST will not be taken into account
        destination_tz = pytz.timezone(self._get_tz())
        start_datetime = pytz.utc.localize(self.start_datetime).astimezone(destination_tz)
        end_datetime = pytz.utc.localize(self.end_datetime).astimezone(destination_tz)

        # convert time delta to hours and minutes
        total_seconds = (end_datetime - start_datetime).total_seconds()
        m, s = divmod(total_seconds, 60)
        h, m = divmod(m, 60)

        return {
            'start_time': start_datetime.hour + start_datetime.minute / 60.0,
            'duration': h + (m / 60.0),
            'role_id': self.role_id.id
        }

    def _read_group_employee_id(self, employees, domain, order):
        dom_tuples = [(dom[0], dom[1]) for dom in domain if isinstance(dom, list) and len(dom) == 3]
        employee_ids = self.env.context.get('filter_employee_ids', False)
        employee_domain = [('id', 'in', employee_ids)] if employee_ids else []
        all_employees = self.env['hr.employee'].search(employee_domain)
        if employee_ids or len(all_employees) < 20:
            return all_employees
        elif self._context.get('planning_expand_employee') and ('start_datetime', '<=') in dom_tuples and ('end_datetime', '>=') in dom_tuples:
            filters = self._expand_domain_dates(domain)
            return self.env['planning.slot'].search(filters).mapped('employee_id')
        return employees

    def _read_group_role_id(self, roles, domain, order):
        dom_tuples = [(dom[0], dom[1]) for dom in domain if isinstance(dom, list) and len(dom) == 3]
        if self._context.get('planning_expand_role') and ('start_datetime', '<=') in dom_tuples and ('end_datetime', '>=') in dom_tuples:
            filters = self._expand_domain_dates(domain)
            return self.env['planning.slot'].search(filters).mapped('role_id')
        return roles

    def _expand_domain_dates(self, domain):
        filters = []
        for dom in domain:
            if len(dom) == 3 and dom[0] == 'start_datetime' and dom[1] == '<=':
                max_date = dom[2] if dom[2] else datetime.now()
                max_date = max_date if isinstance(max_date, date) else datetime.strptime(max_date, '%Y-%m-%d %H:%M:%S')
                max_date = max_date + timedelta(days=30)
                filters.append((dom[0], dom[1], max_date))
            elif len(dom) == 3 and dom[0] == 'end_datetime' and dom[1] == '>=':
                min_date = dom[2] if dom[2] else datetime.now()
                min_date = min_date if isinstance(min_date, date) else datetime.strptime(min_date, '%Y-%m-%d %H:%M:%S')
                min_date = min_date - timedelta(days=30)
                filters.append((dom[0], dom[1], min_date))
            else:
                filters.append(dom)
        return filters

    def _format_start_end_datetime(self, record_env, tz=None, lang_code=False):
        destination_tz = pytz.timezone(tz)
        start_datetime = pytz.utc.localize(self.start_datetime).astimezone(destination_tz).replace(tzinfo=None)
        end_datetime = pytz.utc.localize(self.end_datetime).astimezone(destination_tz).replace(tzinfo=None)
        return (
            format_datetime(record_env, self.start_datetime, tz=tz, dt_format='short', lang_code=lang_code),
            format_datetime(record_env, self.end_datetime, tz=tz, dt_format='short', lang_code=lang_code)
        )

    def _send_slot(self, employee_ids, start_datetime, end_datetime, include_unassigned=True, message=None):
        if not include_unassigned:
            self = self.filtered(lambda s: s.employee_id)
        if not self:
            return False

        employee_with_backend = employee_ids.filtered(lambda e: e.user_id and e.user_id.has_group('planning.group_planning_user'))
        employee_without_backend = employee_ids - employee_with_backend
        planning = False
        if len(self) > 1 or employee_without_backend:
            planning = self.env['planning.planning'].create({
                'start_datetime': start_datetime,
                'end_datetime': end_datetime,
                'include_unassigned': include_unassigned,
                'slot_ids': [(6, 0, self.ids)],
            })
        if len(self) > 1:
            return planning._send_planning(message=message, employees=employee_ids)

        self.ensure_one()

        template = self.env.ref('planning.email_template_slot_single')
        employee_url_map = {**employee_without_backend.sudo()._planning_get_url(planning), **employee_with_backend._slot_get_url()}

        view_context = dict(self._context)
        view_context.update({
            'open_shift_available': not self.employee_id,
            'mail_subject': _('Planning: new open shift available'),
        })

        if self.employee_id:
            employee_ids = self.employee_id
            if self.allow_self_unassign:
                if employee_ids.filtered(lambda e: e.user_id and e.user_id.has_group('planning.group_planning_user')):
                    unavailable_link = '/planning/unassign/%s/%s' % (self.employee_id.sudo().employee_token, self.id)
                else:
                    unavailable_link = '/planning/%s/%s/unassign/%s?message=1' % (planning.access_token, self.employee_id.sudo().employee_token, self.id)
                view_context.update({'unavailable_link': unavailable_link})
            view_context.update({'mail_subject': _('Planning: new shift')})

        mails_to_send_ids = []
        for employee in employee_ids.filtered(lambda e: e.work_email):
            if not self.employee_id and employee in employee_with_backend:
                view_context.update({'available_link': '/planning/assign/%s/%s' % (employee.sudo().employee_token, self.id)})
            elif not self.employee_id:
                view_context.update({'available_link': '/planning/%s/%s/assign/%s?message=1' % (planning.access_token, employee.sudo().employee_token, self.id)})
            start_datetime, end_datetime = self._format_start_end_datetime(employee.env, tz=employee.tz, lang_code=employee.user_partner_id.lang)
            # update context to build a link for view in the slot
            view_context.update({
                'link': employee_url_map[employee.id],
                'start_datetime': start_datetime,
                'end_datetime': end_datetime,
                'employee_name': employee.name,
                'work_email': employee.work_email,
            })
            mail_id = template.with_context(view_context).send_mail(self.id, notif_layout='mail.mail_notification_light')
            mails_to_send_ids.append(mail_id)

        mails_to_send = self.env['mail.mail'].sudo().browse(mails_to_send_ids)
        if mails_to_send:
            mails_to_send.send()

        self.write({
            'is_published': True,
            'publication_warning': False,
        })

    def _filter_slots_front_end(self, employee):
        # Is overridden to filter slots for the front end.
        return self


class PlanningRole(models.Model):
    _name = 'planning.role'
    _description = "Planning Role"
    _order = 'sequence'
    _rec_name = 'name'

    name = fields.Char('Name', required=True)
    color = fields.Integer("Color", default=0)
    employee_ids = fields.Many2many('hr.employee', string='Employees')
    sequence = fields.Integer()


class PlanningPlanning(models.Model):
    _name = 'planning.planning'
    _description = 'Schedule'

    @api.model
    def _default_access_token(self):
        return str(uuid.uuid4())

    start_datetime = fields.Datetime("Start Date", required=True)
    end_datetime = fields.Datetime("Stop Date", required=True)
    include_unassigned = fields.Boolean("Includes Open Shifts", default=True)
    access_token = fields.Char("Security Token", default=_default_access_token, required=True, copy=False, readonly=True)
    slot_ids = fields.Many2many('planning.slot')
    company_id = fields.Many2one('res.company', string="Company", required=True, default=lambda self: self.env.company)

    @api.depends('start_datetime', 'end_datetime')
    def _compute_display_name(self):
        """ This override is need to have a human readable string in the email light layout header (`message.record_name`) """
        for planning in self:
            tz = pytz.timezone(self.env.user.tz or 'UTC')
            start_datetime = pytz.utc.localize(planning.start_datetime).astimezone(tz).replace(tzinfo=None)
            end_datetime = pytz.utc.localize(planning.end_datetime).astimezone(tz).replace(tzinfo=None)
            planning.display_name = _('Planning from %s to %s') % (format_date(self.env, start_datetime), format_date(self.env, end_datetime))

    # ----------------------------------------------------
    # Business Methods
    # ----------------------------------------------------

    def _send_planning(self, message=None, employees=False):
        email_from = self.env.user.email or self.env.user.company_id.email or ''
        sent_slots = self.env['planning.slot']
        for planning in self:
            # prepare planning urls, recipient employees, ...
            slots = planning.slot_ids
            slots_open = slots.filtered(lambda slot: not slot.employee_id) if planning.include_unassigned else 0

            # extract planning URLs
            employees = employees or slots.mapped('employee_id')
            employee_url_map = employees.sudo()._planning_get_url(planning)

            # send planning email template with custom domain per employee
            template = self.env.ref('planning.email_template_planning_planning', raise_if_not_found=False)
            template_context = {
                'slot_unassigned_count': slots_open and len(slots_open),
                'slot_total_count': slots and len(slots),
                'message': message,
            }
            if template:
                # /!\ For security reason, we only given the public employee to render mail template
                for employee in self.env['hr.employee.public'].browse(employees.ids):
                    if employee.work_email:
                        template_context['employee'] = employee
                        destination_tz = pytz.timezone(self.env.user.tz or 'UTC')
                        template_context['start_datetime'] = pytz.utc.localize(planning.start_datetime).astimezone(destination_tz).replace(tzinfo=None)
                        template_context['end_datetime'] = pytz.utc.localize(planning.end_datetime).astimezone(destination_tz).replace(tzinfo=None)
                        template_context['planning_url'] = employee_url_map[employee.id]
                        template_context['assigned_new_shift'] = bool(slots.filtered(lambda slot: slot.employee_id.id == employee.id))
                        template.with_context(**template_context).send_mail(planning.id, email_values={'email_to': employee.work_email, 'email_from': email_from}, notif_layout='mail.mail_notification_light')
            sent_slots |= slots
        # mark as sent
        sent_slots.write({
            'is_published': True,
            'publication_warning': False
        })
        return True
