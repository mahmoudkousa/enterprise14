# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta, datetime
import pytz

from odoo import fields, models, api, _
from odoo.osv import expression


# YTI TODO: Split file into 2
class Project(models.Model):
    _inherit = "project.project"

    is_fsm = fields.Boolean("Field Service", default=False, help="Display tasks in the Field Service module and allow planning with start/end dates.")
    allow_subtasks = fields.Boolean(
        compute="_compute_allow_subtasks", store=True, readonly=False)

    @api.depends("is_fsm")
    def _compute_allow_subtasks(self):
        has_group = self.env.user.has_group("project.group_subtask_project")
        for project in self:
            project.allow_subtasks = has_group and not project.is_fsm

    @api.model
    def default_get(self, fields_list):
        defaults = super().default_get(fields_list)
        if 'allow_subtasks' in fields_list:
            defaults['allow_subtasks'] = defaults.get('allow_subtasks', False) and not defaults.get('is_fsm')
        return defaults


class Task(models.Model):
    _inherit = "project.task"

    @api.model
    def default_get(self, fields_list):
        result = super(Task, self).default_get(fields_list)
        user_tz = pytz.timezone(self.env.context.get('tz') or 'UTC')
        date_begin = result.get('planned_date_begin')
        date_end = result.get('planned_date_end')
        force_today = False
        # force today if default is more than 25 hours (for eg. "Add" button in gantt view)
        if self._context.get('fsm_mode'):
            force_today = date_begin and date_end and abs(date_end - date_begin).total_seconds() > 90000
            if force_today:
                date_begin = fields.Datetime.now()
                date_end = fields.Datetime.now()
        if date_begin and (not self.env.context.get('default_planned_date_begin') or force_today):
            date_begin = pytz.utc.localize(date_begin).astimezone(user_tz)
            date_begin = date_begin.replace(hour=9, minute=0, second=0)
            date_begin = date_begin.astimezone(pytz.utc).replace(tzinfo=None)
            result['planned_date_begin'] = date_begin
        if date_end and (not self.env.context.get('default_planned_date_end') or force_today):
            date_end = pytz.utc.localize(date_end).astimezone(user_tz)
            date_end = date_end.replace(hour=17, minute=0, second=0)
            date_end = date_end.astimezone(pytz.utc).replace(tzinfo=None)
            result['planned_date_end'] = date_end
        if 'project_id' in fields_list and not result.get('project_id') and self._context.get('fsm_mode'):
            company_id = self.env.context.get('default_company_id') or self.env.company.id
            fsm_project = self.env['project.project'].search([('is_fsm', '=', True), ('company_id', '=', company_id)], order='sequence', limit=1)
            if fsm_project:
                result['stage_id'] = self.stage_find(fsm_project.id, [('fold', '=', False), ('is_closed', '=', False)])
            result['project_id'] = fsm_project.id
        return result

    is_fsm = fields.Boolean(related='project_id.is_fsm', search='_search_is_fsm')
    planning_overlap = fields.Integer(compute='_compute_planning_overlap')
    fsm_done = fields.Boolean("Task Done", compute='_compute_fsm_done', readonly=False, store=True)
    user_id = fields.Many2one(group_expand='_read_group_user_ids')
    display_fsm_dates = fields.Boolean(compute='_compute_display_fsm_dates')
    # Use to count conditions between : time, worksheet and materials
    # If 2 over 3 are enabled for the project, the required count = 2
    # If 1 over 3 is met (enabled + encoded), the satisfied count = 2
    display_enabled_conditions_count = fields.Integer(compute='_compute_display_conditions_count')
    display_satisfied_conditions_count = fields.Integer(compute='_compute_display_conditions_count')
    display_mark_as_done_primary = fields.Boolean(compute='_compute_mark_as_done_buttons')
    display_mark_as_done_secondary = fields.Boolean(compute='_compute_mark_as_done_buttons')
    has_complete_partner_address = fields.Boolean(compute='_compute_has_complete_partner_address')

    @api.depends(
        'fsm_done', 'is_fsm', 'timer_start',
        'display_enabled_conditions_count', 'display_satisfied_conditions_count')
    def _compute_mark_as_done_buttons(self):
        for task in self:
            primary, secondary = True, True
            if task.fsm_done or not task.is_fsm or task.timer_start:
                primary, secondary = False, False
            else:
                if task.display_enabled_conditions_count == task.display_satisfied_conditions_count:
                    secondary = False
                else:
                    primary = False
            task.update({
                'display_mark_as_done_primary': primary,
                'display_mark_as_done_secondary': secondary,
            })

    @api.depends('project_id.allow_timesheets', 'total_hours_spent')
    def _compute_display_conditions_count(self):
        for task in self:
            enabled = 1 if task.project_id.allow_timesheets else 0
            satisfied = 1 if enabled and task.total_hours_spent else 0
            task.update({
                'display_enabled_conditions_count': enabled,
                'display_satisfied_conditions_count': satisfied
            })

    @api.depends('fsm_done', 'display_timesheet_timer', 'timer_start', 'total_hours_spent')
    def _compute_display_timer_buttons(self):
        fsm_done_tasks = self.filtered(lambda task: task.fsm_done)
        fsm_done_tasks.update({
            'display_timer_start_primary': False,
            'display_timer_start_secondary': False,
            'display_timer_stop': False,
            'display_timer_pause': False,
            'display_timer_resume': False,
        })
        super(Task, self - fsm_done_tasks)._compute_display_timer_buttons()

    @api.depends('is_fsm')
    def _compute_display_fsm_dates(self):
        for task in self:
            task.display_fsm_dates = task.is_fsm

    @api.depends('partner_id')
    def _compute_has_complete_partner_address(self):
        for task in self:
            task.has_complete_partner_address = task.partner_id.city and task.partner_id.country_id

    @api.model
    def _search_is_fsm(self, operator, value):
        query = """
            SELECT p.id
            FROM project_project P
            WHERE P.active = 't' AND P.is_fsm
        """
        operator_new = operator == "=" and "inselect" or "not inselect"
        return [('project_id', operator_new, (query, ()))]

    @api.model
    def _read_group_user_ids(self, users, domain, order):
        if self.env.context.get('fsm_mode'):
            recently_created_tasks = self.env['project.task'].search([
                ('create_date', '>', datetime.now() - timedelta(days=30)),
                ('is_fsm', '=', True),
                ('user_id', '!=', False)
            ])
            search_domain = ['&',('company_id', 'in', self.env.companies.ids) ,'|', '|', ('id', 'in', users.ids), ('groups_id', 'in', self.env.ref('industry_fsm.group_fsm_user').id), ('id', 'in', recently_created_tasks.mapped('user_id.id'))]
            return users.search(search_domain, order=order)
        return users

    @api.depends('planned_date_begin', 'planned_date_end', 'user_id')
    def _compute_planning_overlap(self):
        if self.ids:
            query = """
                SELECT
                    T1.id, COUNT(T2.id)
                FROM
                    (
                        SELECT
                            T.id as id,
                            T.user_id as user_id,
                            T.project_id,
                            T.planned_date_begin as planned_date_begin,
                            T.planned_date_end as planned_date_end,
                            T.active as active
                        FROM project_task T
                        LEFT OUTER JOIN project_project P ON P.id = T.project_id
                        WHERE T.id IN %s
                            AND T.active = 't'
                            AND P.is_fsm = 't'
                            AND T.planned_date_begin IS NOT NULL
                            AND T.planned_date_end IS NOT NULL
                            AND T.project_id IS NOT NULL
                    ) T1
                INNER JOIN project_task T2
                    ON T1.id != T2.id
                        AND T2.active = 't'
                        AND T1.user_id = T2.user_id
                        AND T2.planned_date_begin IS NOT NULL
                        AND T2.planned_date_end IS NOT NULL
                        AND T2.project_id IS NOT NULL
                        AND (T1.planned_date_begin::TIMESTAMP, T1.planned_date_end::TIMESTAMP)
                            OVERLAPS (T2.planned_date_begin::TIMESTAMP, T2.planned_date_end::TIMESTAMP)
                GROUP BY T1.id
            """
            self.env.cr.execute(query, (tuple(self.ids),))
            raw_data = self.env.cr.dictfetchall()
            overlap_mapping = dict(map(lambda d: d.values(), raw_data))
            for task in self:
                task.planning_overlap = overlap_mapping.get(task.id, 0)
        else:
            self.planning_overlap = False

    def _compute_fsm_done(self):
        for task in self:
            closed_stage = task.project_id.type_ids.filtered('is_closed')
            if closed_stage:
                task.fsm_done = task.stage_id in closed_stage

    def action_view_timesheets(self):
        kanban_view = self.env.ref('hr_timesheet.view_kanban_account_analytic_line')
        form_view = self.env.ref('industry_fsm.timesheet_view_form')
        tree_view = self.env.ref('industry_fsm.timesheet_view_tree_user_inherit')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Time'),
            'res_model': 'account.analytic.line',
            'view_mode': 'list,form,kanban',
            'views': [(tree_view.id, 'list'), (kanban_view.id, 'kanban'), (form_view.id, 'form')],
            'domain': [('task_id', '=', self.id), ('project_id', '!=', False)],
            'context': {
                'fsm_mode': True,
                'default_project_id': self.project_id.id,
                'default_task_id': self.id,
            }
        }

    def action_fsm_validate(self):
        """ Moves Task to next stage.
            If allow billable on task, timesheet product set on project and user has privileges :
            Create SO confirmed with time and material.
        """
        self._stop_all_timers_and_create_timesheets()
        for task in self:
            # determine closed stage for task
            closed_stage = task.project_id.type_ids.filtered(lambda stage: stage.is_closed)[:1]  # select the 1st closing stage if there are multiples closing stages
            if not closed_stage and len(task.project_id.type_ids) > 1:  # project without stage (or with only one)
                closed_stage = task.project_id.type_ids[-1]

            values = {'fsm_done': True}
            if closed_stage:
                values['stage_id'] = closed_stage.id

            task.write(values)

    def _stop_all_timers_and_create_timesheets(self):
        ConfigParameter = self.env['ir.config_parameter'].sudo()
        Timesheet = self.env['account.analytic.line']
        Timer = self.env['timer.timer']

        tasks_running_timer_ids = Timer.search([('res_model', '=', 'project.task'), ('res_id', 'in', self.ids)])
        timesheets = Timesheet.sudo().search([('task_id', 'in', self.ids)])
        timesheets_running_timer_ids = None
        if timesheets:
            timesheets_running_timer_ids = Timer.search([
                ('res_model', '=', 'account.analytic.line'),
                ('res_id', 'in', timesheets.ids)])
        if not tasks_running_timer_ids and not timesheets_running_timer_ids:
            return Timesheet

        result = Timesheet
        minimum_duration = int(ConfigParameter.get_param('hr_timesheet.timesheet_min_duration', 0))
        rounding = int(ConfigParameter.get_param('hr_timesheet.timesheet_rounding', 0))
        if tasks_running_timer_ids:
            task_dict = {task.id: task for task in self}
            timesheets_val = []
            for timer in tasks_running_timer_ids:
                minutes_spent = timer._get_minutes_spent()
                time_spent = self._timer_rounding(minutes_spent, minimum_duration, rounding) / 60
                task = task_dict[timer.res_id]
                timesheets_val.append({
                    'task_id': task.id,
                    'project_id': task.project_id.id,
                    'user_id': timer.user_id.id,
                    'unit_amount': time_spent,
                })
            tasks_running_timer_ids.sudo().unlink()
            result += Timesheet.sudo().create(timesheets_val)

        if timesheets_running_timer_ids:
            timesheets_dict = {timesheet.id: timesheet for timesheet in timesheets}
            for timer in timesheets_running_timer_ids:
                timesheet = timesheets_dict[timer.res_id]
                minutes_spent = timer._get_minutes_spent()
                timesheet._add_timesheet_time(minutes_spent)
                result += timesheet
            timesheets_running_timer_ids.sudo().unlink()

        return result

    def action_fsm_view_overlapping_tasks(self):
        fsm_task_form_view = self.env.ref('project.view_task_form2')
        fsm_task_list_view = self.env.ref('industry_fsm.project_task_view_list_fsm')
        fsm_task_kanban_view = self.env.ref('industry_fsm.project_task_view_kanban_fsm')
        domain = self._get_fsm_overlap_domain()[self.id]
        return {
            'type': 'ir.actions.act_window',
            'name': _('Overlapping Tasks'),
            'res_model': 'project.task',
            'domain': domain,
            'views': [(fsm_task_list_view.id, 'tree'), (fsm_task_kanban_view.id, 'kanban'), (fsm_task_form_view.id, 'form')],
            'context': {
                'fsm_mode': True,
                'task_nameget_with_hours': False,
            }
        }

    def action_fsm_navigate(self):
        if not self.partner_id.partner_latitude and not self.partner_id.partner_longitude:
            self.partner_id.geo_localize()
        # YTI TODO: The url should be set with single method everywhere in the codebase
        url = "https://www.google.com/maps/dir/?api=1&destination=%s,%s" % (self.partner_id.partner_latitude, self.partner_id.partner_longitude)
        return {
            'type': 'ir.actions.act_url',
            'url': url,
            'target': 'new'
        }

    def _get_fsm_overlap_domain(self):
        domain_mapping = {}
        for task in self:
            domain_mapping[task.id] = [
                '&',
                    '&',
                        '&',
                            ('is_fsm', '=', True),
                            ('user_id', '=', task.user_id.id),
                        '&',
                            ('planned_date_begin', '<', task.planned_date_end),
                            ('planned_date_end', '>', task.planned_date_begin),
                    ('project_id', '!=', False)
            ]
            current_id = task._origin.id
            if current_id:
                domain_mapping[task.id] = expression.AND([domain_mapping[task.id], [('id', '!=', current_id)]])
        return domain_mapping
