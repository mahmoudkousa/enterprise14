# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import pytz

from collections import defaultdict
from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.tools import float_round, date_utils
from odoo.tools.float_utils import float_compare

EMPLOYER_ONSS = 0.2714


class HrContract(models.Model):
    _inherit = 'hr.contract'

    transport_mode_car = fields.Boolean('Uses company car')
    transport_mode_private_car = fields.Boolean('Uses private car')
    transport_mode_train = fields.Boolean('Uses train transportation')
    transport_mode_public = fields.Boolean('Uses another public transportation')
    car_atn = fields.Monetary(string='Benefit in Kind (Company Car)')
    train_transport_employee_amount = fields.Monetary('Train transport paid by the employee (Monthly)')
    public_transport_employee_amount = fields.Monetary('Public transport paid by the employee (Monthly)')
    warrant_value_employee = fields.Monetary(compute='_compute_commission_cost', string="Warrant monthly value for the employee")

    meal_voucher_paid_by_employer = fields.Monetary(compute='_compute_meal_voucher_paid_by_employer', string="Meal Voucher Paid by Employer")
    meal_voucher_paid_monthly_by_employer = fields.Monetary(compute='_compute_meal_voucher_paid_by_employer')
    company_car_total_depreciated_cost = fields.Monetary()
    private_car_reimbursed_amount = fields.Monetary(compute='_compute_private_car_reimbursed_amount')
    km_home_work = fields.Integer(related="employee_id.km_home_work", related_sudo=True, readonly=False)
    train_transport_reimbursed_amount = fields.Monetary(string='Train Transport Reimbursed amount',
        compute='_compute_train_transport_reimbursed_amount', readonly=False, store=True)
    public_transport_reimbursed_amount = fields.Monetary(string='Public Transport Reimbursed amount',
        compute='_compute_public_transport_reimbursed_amount', readonly=False, store=True)
    others_reimbursed_amount = fields.Monetary(string='Other Reimbursed amount')
    warrants_cost = fields.Monetary(compute='_compute_commission_cost', string="Warrant monthly cost for the employer")
    yearly_commission = fields.Monetary(compute='_compute_commission_cost')
    yearly_commission_cost = fields.Monetary(compute='_compute_commission_cost')

    # Advantages
    commission_on_target = fields.Monetary(string="Commission on Target",
        tracking=True,
        help="Monthly gross amount that the employee receives if the target is reached.")
    fuel_card = fields.Monetary(string="Fuel Card",
        tracking=True,
        help="Monthly amount the employee receives on his fuel card.")
    internet = fields.Monetary(string="Internet",
        tracking=True,
        help="The employee's internet subcription will be paid up to this amount.")
    representation_fees = fields.Monetary(string="Representation Fees",
        tracking=True,
        help="Monthly net amount the employee receives to cover his representation fees.")
    mobile = fields.Monetary(string="Mobile",
        tracking=True,
        help="The employee's mobile subscription will be paid up to this amount.")
    has_laptop = fields.Boolean(string="Laptop",
        tracking=True,
        help="A benefit in kind is paid when the employee uses its laptop at home.")
    meal_voucher_amount = fields.Monetary(string="Meal Vouchers",
        tracking=True,
        help="Amount the employee receives in the form of meal vouchers per worked day.")
    eco_checks = fields.Monetary("Eco Vouchers",
        help="Yearly amount the employee receives in the form of eco vouchers.")
    ip = fields.Boolean(default=False, tracking=True)
    ip_wage_rate = fields.Float(string="IP percentage", help="Should be between 0 and 100 %")
    ip_value = fields.Float(compute='_compute_ip_value')
    time_credit = fields.Boolean('Credit time', readonly=False, help='This is a credit time contract.')
    work_time_rate = fields.Selection([
        ('0', 'Set To Full Time'),
        ('0.5', '1/2'),
        ('0.8', '4/5'),
        ('0.9', '9/10')
        ], string='Work time rate', readonly=False,
        help='Work time rate versus full time working schedule.')
    standard_calendar_id = fields.Many2one('resource.calendar', default=lambda self: self.env.company.resource_calendar_id)
    fiscal_voluntarism = fields.Boolean(
        string="Fiscal Voluntarism", default=False, tracking=True,
        help="Voluntarily increase withholding tax rate.")
    fiscal_voluntary_rate = fields.Float(string="Fiscal Voluntary Rate", help="Should be between 0 and 100 %")
    attachment_salary_ids = fields.One2many('l10n_be.attachment.salary', 'contract_id')

    _sql_constraints = [
        ('check_percentage_ip_rate', 'CHECK(ip_wage_rate >= 0 AND ip_wage_rate <= 100)', 'The IP rate on wage should be between 0 and 100.'),
        ('check_percentage_fiscal_voluntary_rate', 'CHECK(fiscal_voluntary_rate >= 0 AND fiscal_voluntary_rate <= 100)', 'The Fiscal Voluntary rate on wage should be between 0 and 100.')
    ]

    @api.depends('ip', 'ip_wage_rate')
    def _compute_ip_value(self):
        for contract in self:
            contract.ip_value = contract.ip_wage_rate if contract.ip else 0

    @api.depends('commission_on_target')
    def _compute_commission_cost(self):
        for contract in self:
            contract.warrants_cost = contract.commission_on_target * 1.326 / 1.05
            warrant_commission = contract.warrants_cost * 3.0
            cash_commission = contract.commission_on_target * 9.0
            contract.yearly_commission_cost = warrant_commission + cash_commission * (1 + EMPLOYER_ONSS)
            contract.yearly_commission = warrant_commission + cash_commission
            contract.warrant_value_employee = contract.commission_on_target * 1.326 * (1.00 - 0.535)

    @api.depends('meal_voucher_amount')
    def _compute_meal_voucher_paid_by_employer(self):
        for contract in self:
            contract.meal_voucher_paid_by_employer = contract.meal_voucher_amount * (1 - 0.1463)
            contract.meal_voucher_paid_monthly_by_employer = contract.meal_voucher_paid_by_employer * 220.0 / 12.0

    @api.depends('train_transport_employee_amount')
    def _compute_train_transport_reimbursed_amount(self):
        for contract in self:
            contract.train_transport_reimbursed_amount = contract._get_train_transport_reimbursed_amount(contract.train_transport_employee_amount)

    def _get_train_transport_reimbursed_amount(self, amount):
        return min(amount * 0.8, 311)

    @api.depends('public_transport_employee_amount')
    def _compute_public_transport_reimbursed_amount(self):
        for contract in self:
            contract.public_transport_reimbursed_amount = contract._get_public_transport_reimbursed_amount(contract.public_transport_employee_amount)

    def _get_public_transport_reimbursed_amount(self, amount):
        # As of February 1st, 2020, reimbursement for non-train-based public transportation,
        # when based on a flat fee, is computed as 71.8% of the actual cost, capped at the
        # reimbursement for 7 km of train-based transportation (34.00 EUR)
        # Source: http://www.cnt-nar.be/CCT-COORD/cct-019-09.pdf (Art. 4)
        return min(amount * 0.718, 34)

    @api.depends('km_home_work', 'transport_mode_private_car')
    def _compute_private_car_reimbursed_amount(self):
        for contract in self:
            if contract.transport_mode_private_car:
                amount = self._get_private_car_reimbursed_amount(contract.km_home_work)
            else:
                amount = 0.0
            contract.private_car_reimbursed_amount = amount

    @api.onchange('transport_mode_car', 'transport_mode_train', 'transport_mode_public')
    def _onchange_transport_mode(self):
        if not self.transport_mode_car:
            self.fuel_card = 0
            self.company_car_total_depreciated_cost = 0
        if not self.transport_mode_train:
            self.train_transport_reimbursed_amount = 0
        if not self.transport_mode_public:
            self.public_transport_reimbursed_amount = 0

    @api.model
    def _get_private_car_reimbursed_amount(self, distance):
        # monthly train subscription amount => half is reimbursed
        # Generally this is not mandatory
        # See: https://emploi.belgique.be/fr/themes/remuneration/intervention-de-lemployeur-dans-les-frais-de-deplacement-domicile-lieu-de
        # But this is the case for the CP200
        # See: https://www.sfonds200.be/fonds-social/infos-sectorielles/frais-de-transport/prive-2020
        private_car_reimbursement_scale = self.env['hr.rule.parameter'].sudo()._get_parameter_from_code(
            'private_car_reimbursement_scale', raise_if_not_found=False)
        if not private_car_reimbursement_scale:
            # YTI TODO master: return 0
            private_car_reimbursement_scale = [
                (0, 0.0),
                (3, 37.0), (4, 40.5), (5, 43.5), (6, 46.5),
                (7, 49.5), (8, 52.0), (9, 55.0), (10, 58.0),
                (11, 61.0), (12, 63.0), (13, 66.0), (14, 69.0),
                (15, 72.0), (16, 75.0), (17, 77.0), (18, 80.0),
                (19, 83.0), (20, 86.0), (21, 88.0), (22, 91.0),
                (23, 94.0), (24, 97.0), (25, 100.0), (26, 102.0),
                (27, 105.0), (28, 108.0), (29, 111.0), (30, 114.0),
                (33, 118.0), (36, 125.0), (39, 132.0), (42, 139.0),
                (45, 146.0), (48, 153.0), (51, 159.0), (54, 164.0),
                (57, 169.0), (60, 174.0), (65, 181.0), (70, 189.0),
                (75, 197.0), (80, 205.0), (85, 213.0), (90, 221.0),
                (95, 229.0), (100, 238.0), (105, 246.0), (110, 254.0),
                (115, 262.0), (120, 270.0), (125, 278.0), (130, 287.0),
                (135, 295.0), (140, 303.0), (145, 311.0), (150, 322.0)]
        for distance_boundary, amount in private_car_reimbursement_scale:
            if distance <= distance_boundary:
                return amount / 2
        return private_car_reimbursement_scale[-1][1] / 2

    @api.model
    def update_state(self):
        # Called by a cron
        # It schedules an activity before the expiration of a credit time contract
        date_today = fields.Date.from_string(fields.Date.today())
        outdated_days = fields.Date.to_string(date_today + relativedelta(days=+14))
        nearly_expired_contracts = self.search([('state', '=', 'open'), ('time_credit', '=', True), ('date_end', '<', outdated_days)])
        nearly_expired_contracts.write({'kanban_state': 'blocked'})

        for contract in nearly_expired_contracts.filtered(lambda contract: contract.hr_responsible_id):
            contract.activity_schedule(
                'mail.mail_activity_data_todo', contract.date_end,
                user_id=contract.hr_responsible_id.id)

        return super(HrContract, self).update_state()

    def _get_contract_credit_time_values(self, date_start, date_stop):
        self.ensure_one()
        contract_vals = []
        if not self.time_credit:
            return contract_vals

        employee = self.employee_id
        resource = employee.resource_id
        calendar = self.resource_calendar_id
        standard_calendar = self.standard_calendar_id

        # YTI TODO master: The domain is hacky, but we can't modify the method signature
        # Add an argument compute_leaves=True on the method
        standard_attendances = standard_calendar._work_intervals_batch(
            pytz.utc.localize(date_start) if not date_start.tzinfo else date_start,
            pytz.utc.localize(date_stop) if not date_stop.tzinfo else date_stop,
            resources=resource,
            domain=[('resource_id', '=', -1)])[resource.id]


        # YTI TODO master: The domain is hacky, but we can't modify the method signature
        # Add an argument compute_leaves=True on the method
        attendances = calendar._work_intervals_batch(
            pytz.utc.localize(date_start) if not date_start.tzinfo else date_start,
            pytz.utc.localize(date_stop) if not date_stop.tzinfo else date_stop,
            resources=resource,
            domain=[('resource_id', '=', -1)]
        )[resource.id]

        credit_time_intervals = standard_attendances - attendances

        for interval in credit_time_intervals:
            work_entry_type_id = self.structure_type_id.time_credit_type_id
            contract_vals += [{
                'name': "%s: %s" % (work_entry_type_id.name, employee.name),
                'date_start': interval[0].astimezone(pytz.utc).replace(tzinfo=None),
                'date_stop': interval[1].astimezone(pytz.utc).replace(tzinfo=None),
                'work_entry_type_id': work_entry_type_id.id,
                'is_credit_time': True,
                'employee_id': employee.id,
                'contract_id': self.id,
                'company_id': self.company_id.id,
                'state': 'draft',
            }]
        return contract_vals

    def _get_contract_work_entries_values(self, date_start, date_stop):
        self.ensure_one()
        contract_vals = super()._get_contract_work_entries_values(date_start, date_stop)
        contract_vals += self._get_contract_credit_time_values(date_start, date_stop)
        return contract_vals

    def _get_work_hours_split_half(self, date_from, date_to, domain=None):
        """
        Returns the amount (expressed in hours) of work
        for a contract between two dates.
        If called on multiple contracts, sum work amounts of each contract.
        :param date_from: The start date
        :param date_to: The end date
        :returns: a dictionary {(half/full, work_entry_id_1): hours_1, (half/full, work_entry_id_2): hours_2}
        """

        generated_date_max = min(fields.Date.to_date(date_to), date_utils.end_of(fields.Date.today(), 'month'))
        self._generate_work_entries(date_from, generated_date_max)
        date_from = datetime.combine(date_from, datetime.min.time())
        date_to = datetime.combine(date_to, datetime.max.time())
        work_data = defaultdict(lambda: list([0, 0]))  # [days, hours]
        number_of_hours_full_day = self.resource_calendar_id._get_max_number_of_hours(date_from, date_to)

        # First, found work entry that didn't exceed interval.
        work_entries = self.env['hr.work.entry'].read_group(
            self._get_work_hours_domain(date_from, date_to, domain=domain, inside=True),
            ['hours:sum(duration)', 'work_entry_type_id'],
            ['date_start:day', 'work_entry_type_id'],
            lazy=False
        )

        for day_data in work_entries:
            work_entry_type_id = day_data['work_entry_type_id'][0] if day_data['work_entry_type_id'] else False
            duration = day_data['hours']
            if float_compare(day_data['hours'], number_of_hours_full_day, 2) != -1:
                if number_of_hours_full_day:
                    number_of_days = float_round(duration / number_of_hours_full_day, precision_rounding=1, rounding_method='HALF-UP')
                else:
                    number_of_days = 1 # If not supposed to work in calendar attendances, then there
                                       # are not time offs
                work_data[('full', work_entry_type_id)][0] += number_of_days
                work_data[('full', work_entry_type_id)][1] += duration
            else:
                work_data[('half', work_entry_type_id)][0] += 1
                work_data[('half', work_entry_type_id)][1] += duration

        # Second, find work entry that exceeds interval and compute right duration.
        work_entries = self.env['hr.work.entry'].search(self._get_work_hours_domain(date_from, date_to, domain=domain, inside=False))

        for work_entry in work_entries:
            date_start = max(date_from, work_entry.date_start)
            date_stop = min(date_to, work_entry.date_stop)
            if work_entry.work_entry_type_id.is_leave:
                contract = work_entry.contract_id
                calendar = contract.resource_calendar_id
                employee = contract.employee_id
                contract_data = employee._get_work_days_data_batch(
                    date_start, date_stop, compute_leaves=False, calendar=calendar
                )[employee.id]
                if float_compare(contract_data.get('hours', 0), number_of_hours_full_day, 2) != -1:
                    work_data[('full', work_entry.work_entry_type_id.id)][0] += 1
                    work_data[('full', work_entry.work_entry_type_id.id)][1] += duration
                else:
                    work_data[('half', work_entry.work_entry_type_id.id)][1] += duration
            else:
                dt = date_stop - date_start
                work_data[('half', work_entry.work_entry_type_id.id)] += dt.days * 24 + dt.seconds / 3600  # Number of hours
        return work_data

    # override to add work_entry_type from leave
    def _get_leave_work_entry_type_dates(self, leave, date_from, date_to):
        result = super()._get_leave_work_entry_type_dates(leave, date_from, date_to)
        if self.structure_type_id.country_id.code != 'BE':
            return result
        # The salary is not guaranteed after 30 calendar days of sick leave (it means from the 31th
        # day of sick leave)
        sick_work_entry_type = self.env.ref('hr_work_entry_contract.work_entry_type_sick_leave')
        if result == sick_work_entry_type:
            partial_sick_work_entry_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_part_sick')
            long_sick_work_entry_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_long_sick')
            sick_work_entry_types = sick_work_entry_type + partial_sick_work_entry_type + long_sick_work_entry_type
            sick_less_than_30days_before = self.env['hr.leave'].search([
                ('employee_id', '=', self.employee_id.id),
                ('date_to', '>=', leave.date_from + relativedelta(days=-30)),
                ('date_from', '<=', leave.holiday_id.date_from),
                ('holiday_status_id.work_entry_type_id', 'in', sick_work_entry_types.ids),
                ('state', '=', 'validate'),
                ('id', '!=', leave.holiday_id.id),
            ], order="date_from asc")
            if not leave.holiday_id:
                return result
            # The current time off is longer than 30 days -> Partial Time Off
            if (date_from - leave.holiday_id.date_from).days + 1 > 30:
                return partial_sick_work_entry_type
            # No previous sick time off -> Sick Time Off
            if not sick_less_than_30days_before:
                return result
            # If there a gap of more than 15 days between 2 sick time offs,
            # the salary is guaranteed -> Sick Time Off
            all_leaves = sick_less_than_30days_before | leave.holiday_id
            for i in range(len(all_leaves) - 1):
                if (all_leaves[i+1].date_from - all_leaves[i].date_to).days > 15:
                    return result
            # No gap and more than 30 calendar days -> Partial Time Off
            # only the first 30 calendar days of sickness are covered by guaranteed wages, which
            # does not mean 30 days of sickness.
            # Example :
            # - Sick from September 1 to 7 included
            # - Rework from 8 to 14
            # - Re-ill from September 15 to October 13
            # Here, are therefore covered by guaranteed wages:
            # from 01 to 07/09 (i.e. 7 days)
            # from 15/09 to 07/10 (i.e. the balance of 23 days).
            # In fact, we and public holidays which fall within a period covered by a medical
            # certificate are taken into account in the period of 30 calendar days of guaranteed
            # salary.
            # Sick days from 08/10 are therefore not covered by the employer (mutual from 08/10
            # to 13/10).
            total_sick_days = sum([(l.date_to - l.date_from).days + 1 for l in sick_less_than_30days_before])
            this_leave_current_duration = (date_from - leave.holiday_id.date_from).days + 1
            if total_sick_days + this_leave_current_duration > 30:
                return partial_sick_work_entry_type
        return result

    def _get_work_entries_values(self, date_start, date_stop):
        res = super()._get_work_entries_values(date_start, date_stop)
        partial_sick_work_entry_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_part_sick')
        leave_ids = list(set([we['leave_id'] for we in res if we['work_entry_type_id'] == partial_sick_work_entry_type.id and 'leave_id' in we]))
        for leave in self.env['hr.leave'].sudo().browse(leave_ids):
            leave.activity_schedule(
                'mail.mail_activity_data_todo',
                note=_("Sick time off to report to DRS for %s.,", date_start.strftime('%B %Y')),
                user_id=leave.holiday_status_id.responsible_id.id or self.env.user.id,
            )
        return res

    def _get_bypassing_work_entry_type(self):
        return super()._get_bypassing_work_entry_type() | self.env.ref('l10n_be_hr_payroll.work_entry_type_long_sick')

    def _create_credit_time_next_activity(self):
        self.ensure_one()
        part_time_link = "https://www.socialsecurity.be/site_fr/employer/applics/elo/index.htm"
        part_time_link = '<a href="%s" target="_blank">%s</a>' % (part_time_link, part_time_link)
        self.activity_schedule(
            'mail.mail_activity_data_todo',
            note=_('Part Time of %s must be stated at %s.',
                   self.employee_id.name,
                   part_time_link),
            user_id=self.hr_responsible_id.id or self.env.user.id,
        )

    def _create_dimona_next_activity(self):
        self.ensure_one()
        dimona_link = "https://www.socialsecurity.be/site_fr/employer/applics/dimona/index.htm"
        dimona_link = '<a href="%s" target="_blank">%s</a>' % (dimona_link, dimona_link)
        self.activity_schedule(
            'mail.mail_activity_data_todo',
            note=_('State the Dimona at %s to declare the arrival of %s.',
                   dimona_link,
                   self.employee_id.name),
            user_id=self.hr_responsible_id.id or self.env.user.id,
            )

    def _trigger_l10n_be_next_activities(self):
        employees_with_contract_domain = [
            ('state', 'in', ('open', 'close')),
            ('employee_id', 'in', self.mapped('employee_id').ids),
            ('id', 'not in', self.ids),
        ]
        employees_already_started = self.env['hr.contract'].search(employees_with_contract_domain).mapped('employee_id')
        for contract in self.filtered(lambda c: c.structure_type_id and c.structure_type_id.country_id.code == "BE"):
            if contract.time_credit:
                contract._create_credit_time_next_activity()
            if contract.employee_id not in employees_already_started:
                contract._create_dimona_next_activity()

    def write(self, vals):
        res = super(HrContract, self).write(vals)
        if vals.get('state') == 'open':
            self._trigger_l10n_be_next_activities()
        return res

    @api.model
    def create(self, vals):
        contract = super(HrContract, self).create(vals)
        if contract.state == 'open':
            contract._trigger_l10n_be_next_activities()
        return contract
