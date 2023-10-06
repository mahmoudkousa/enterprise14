#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models
from odoo.tools import date_utils
from odoo.tools import float_round


class Payslip(models.Model):
    _inherit = 'hr.payslip'

    @api.onchange('employee_id', 'struct_id', 'contract_id', 'date_from', 'date_to')
    def _onchange_employee(self):
        res = super()._onchange_employee()
        struct_commission = self.env.ref('l10n_be_hr_payroll_variable_revenue.hr_payroll_structure_cp200_structure_commission')
        if self.struct_id == struct_commission:
            months = relativedelta(date_utils.add(self.date_to, days=1), self.date_from).months
            if self.employee_id.id in self.env.context.get('commission_real_values', {}):
                commission_value = self.env.context['commission_real_values'][self.employee_id.id]
            else:
                commission_value = self.contract_id.commission_on_target * months
            commission_type = self.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_other_input_commission')
            lines_to_remove = self.input_line_ids.filtered(lambda x: x.input_type_id == commission_type)
            to_remove_vals = [(3, line.id, False) for line in lines_to_remove]
            to_add_vals = [(0, 0, {
                'amount': commission_value,
                'input_type_id': self.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_other_input_commission').id,
            })]
            input_line_vals = to_remove_vals + to_add_vals
            self.update({'input_line_ids': input_line_vals})
        return res

    def _get_paid_amount(self):
        self.ensure_one()
        belgian_payslip = self.struct_id.country_id.code == 'BE'
        if belgian_payslip:
            struct_warrant = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_structure_warrant')
            if self.struct_id == struct_warrant:
                return self._get_paid_amount_warrant()
        return super()._get_paid_amount()

    def _get_worked_day_lines_values(self, domain=None):
        res = super()._get_worked_day_lines_values(domain=domain)
        if self.struct_id.country_id.code != 'BE':
            return res
        if not self._get_last_year_average_variable_revenues():
            return res
        we_types_ids = (
            self.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday') + self.env.ref('l10n_be_hr_payroll.work_entry_type_small_unemployment')
        ).ids
        # if self.worked_days_line_ids.filtered(lambda wd: wd.code in ['LEAVE205', 'LEAVE500']):
        if any(line_vals['work_entry_type_id'] in we_types_ids for line_vals in res):
            we_type = self.env.ref('l10n_be_hr_payroll_variable_revenue.work_entry_type_simple_holiday_pay_variable_salary')
            res.append({
                'sequence': we_type.sequence,
                'work_entry_type_id': we_type.id,
                'number_of_days': 0,
                'number_of_hours': 0,
            })
        return res

    def _get_last_year_average_variable_revenues(self):
        payslips = self.env['hr.payslip'].search([
            ('employee_id', '=', self.employee_id.id),
            ('state', '=', 'done'),
            ('date_from', '>=', self.date_from + relativedelta(months=-12)),
            ('date_from', '<', self.date_from),
        ], order="date_from asc")
        complete_payslips = payslips.filtered(
            lambda p: not p._get_worked_days_line_number_of_hours('OUT'))
        total_amount = 0
        for code in ['COM', 'COMMISSION']:
            total_amount += sum(p._get_salary_line_total(code) for p in complete_payslips)
        first_contract_date = self.employee_id.first_contract_date
        if not first_contract_date:
            return 0
        start = first_contract_date
        # Only complete months count
        if first_contract_date.day != 1:
            start = first_contract_date + relativedelta(day=1, months=1)
        else:
            start = first_contract_date
        end = self.date_from + relativedelta(day=31, months=-1)
        number_of_month = (end.year - start.year) * 12 + (end.month - start.month) + 1
        number_of_month = min(12, number_of_month)
        return total_amount / number_of_month if number_of_month else 0

    def _get_base_local_dict(self):
        res = super()._get_base_local_dict()
        res.update({
            'compute_withholding_taxes_adjustment': compute_withholding_taxes_adjustment,
            'compute_special_social_cotisations_commissions': compute_special_social_cotisations_commissions,
            'compute_employment_bonus_employees_commissions': compute_employment_bonus_employees_commissions,
            'compute_withholding_reduction_commissions': compute_withholding_reduction_commissions,
        })
        return res

    def _get_pp_taxable_amount(self):
        commission_structure = self.env.ref('l10n_be_hr_payroll_variable_revenue.hr_payroll_structure_cp200_structure_commission')
        commissions_payslips = self.filtered(lambda p: p.struct_id == commission_structure)
        result = sum(abs(p._get_salary_line_total('COM')) for p in commissions_payslips)
        return result + super(Payslip, self - commissions_payslips)._get_pp_taxable_amount()

# YTI TODO master: Duplicated code due to stable development. the method signature could be changed
# and cleaned afterward
def compute_withholding_taxes_adjustment(payslip, categories, worked_days, inputs):

    def compute_basic_bareme(value):
        rates = payslip.rule_parameter('basic_bareme_rates')
        rates = [(limit or float('inf'), rate) for limit, rate in rates]  # float('inf') because limit equals None for last level
        rates = sorted(rates)

        basic_bareme = 0
        previous_limit = 0
        for limit, rate in rates:
            basic_bareme += max(min(value, limit) - previous_limit, 0) * rate
            previous_limit = limit
        return float_round(basic_bareme, precision_rounding=0.01)

    def convert_to_month(value):
        return float_round(value / 12.0, precision_rounding=0.01, rounding_method='DOWN')

    employee = payslip.contract_id.employee_id
    # PART 1: Withholding tax amount computation
    withholding_tax_amount = 0.0

    taxable_amount = categories.BASIC
    # YTI TODO: master: Move this into another rule (like benefit in kind)
    if payslip.contract_id.transport_mode_private_car:
        threshold = payslip.env['hr.rule.parameter']._get_parameter_from_code(
            'pricate_car_taxable_threshold',
            date=payslip.date_to,
            raise_if_not_found=False)
        if threshold is None:
            threshold = 410  # 2020 value
        if payslip.contract_id.private_car_reimbursed_amount > (threshold / 12):
            taxable_amount += payslip.contract_id.private_car_reimbursed_amount - (threshold / 12)

    lower_bound = taxable_amount - taxable_amount % 15

    # yearly_gross_revenue = Revenu Annuel Brut
    yearly_gross_revenue = lower_bound * 12.0

    # yearly_net_taxable_amount = Revenu Annuel Net Imposable
    if yearly_gross_revenue <= payslip.rule_parameter('yearly_gross_revenue_bound_expense'):
        yearly_net_taxable_revenue = yearly_gross_revenue * (1.0 - 0.3)
    else:
        yearly_net_taxable_revenue = yearly_gross_revenue - payslip.rule_parameter('expense_deduction')

    # BAREME III: Non resident
    if employee.resident_bool:
        basic_bareme = compute_basic_bareme(yearly_net_taxable_revenue)
        withholding_tax_amount = convert_to_month(basic_bareme)
    else:
        # BAREME I: Isolated or spouse with income
        if employee.marital in ['divorced', 'single', 'widower'] or (employee.marital in ['married', 'cohabitant'] and employee.spouse_fiscal_status != 'without_income'):
            basic_bareme = max(compute_basic_bareme(yearly_net_taxable_revenue) - payslip.rule_parameter('deduct_single_with_income'), 0.0)
            withholding_tax_amount = convert_to_month(basic_bareme)

        # BAREME II: spouse without income
        if employee.marital in ['married', 'cohabitant'] and employee.spouse_fiscal_status == 'without_income':
            yearly_net_taxable_revenue_for_spouse = min(yearly_net_taxable_revenue * 0.3, payslip.rule_parameter('max_spouse_income'))
            basic_bareme_1 = compute_basic_bareme(yearly_net_taxable_revenue_for_spouse)
            basic_bareme_2 = compute_basic_bareme(yearly_net_taxable_revenue - yearly_net_taxable_revenue_for_spouse)
            withholding_tax_amount = convert_to_month(max(basic_bareme_1 + basic_bareme_2 - 2 * payslip.rule_parameter('deduct_single_with_income'), 0))

    # Reduction for other family charges
    if employee.other_dependent_people and (employee.dependent_seniors or employee.dependent_juniors):
        if employee.marital in ['divorced', 'single', 'widower'] or (employee.spouse_fiscal_status != 'without_income'):
            if employee.marital in ['divorced', 'single', 'widower']:
                withholding_tax_amount -= payslip.rule_parameter('isolated_deduction')
            if employee.marital == 'widower' or (employee.marital in ['divorced', 'single', 'widower'] and employee.dependent_children):
                withholding_tax_amount -= payslip.rule_parameter('disabled_dependent_deduction')
            if employee.disabled:
                withholding_tax_amount -= payslip.rule_parameter('disabled_dependent_deduction')
            if employee.other_dependent_people and employee.dependent_seniors:
                withholding_tax_amount -= payslip.rule_parameter('dependent_senior_deduction') * employee.dependent_seniors
            if employee.other_dependent_people and employee.dependent_juniors:
                withholding_tax_amount -= payslip.rule_parameter('disabled_dependent_deduction') * employee.dependent_juniors
            if employee.marital in ['married', 'cohabitant'] and employee.spouse_fiscal_status =='low_income':
                withholding_tax_amount -= payslip.rule_parameter('spouse_low_income_deduction')
            if employee.marital in ['married', 'cohabitant'] and employee.spouse_fiscal_status =='low_pension':
                withholding_tax_amount -= payslip.rule_parameter('spouse_other_income_deduction')
        if employee.marital in ['married', 'cohabitant'] and employee.spouse_fiscal_status == 'without_income':
            if employee.disabled:
                withholding_tax_amount -= payslip.rule_parameter('disabled_dependent_deduction')
            if employee.disabled_spouse_bool:
                withholding_tax_amount -= payslip.rule_parameter('disabled_dependent_deduction')
            if employee.other_dependent_people and employee.dependent_seniors:
                withholding_tax_amount -= payslip.rule_parameter('dependent_senior_deduction') * employee.dependent_seniors
            if employee.other_dependent_people and employee.dependent_juniors:
                withholding_tax_amount -= payslip.rule_parameter('disabled_dependent_deduction') * employee.dependent_juniors

    # Child Allowances
    n_children = employee.dependent_children
    if n_children > 0:
        children_deduction = payslip.rule_parameter('dependent_basic_children_deduction')
        if n_children <= 8:
            withholding_tax_amount -= children_deduction.get(n_children, 0.0)
        if n_children > 8:
            withholding_tax_amount -= children_deduction.get(8, 0.0) + (n_children - 8) * payslip.rule_parameter('dependent_children_deduction')

    if payslip.contract_id.fiscal_voluntarism:
        voluntary_amount = categories.GROSS * payslip.contract_id.fiscal_voluntary_rate / 100
        if voluntary_amount > withholding_tax_amount:
            withholding_tax_amount = voluntary_amount

    return - max(withholding_tax_amount, 0.0)

def compute_special_social_cotisations_commissions(payslip, categories, worked_days, inputs):
    employee = payslip.contract_id.employee_id
    wage = categories.GROSS
    result = 0.0
    if not wage:
        return result
    if employee.resident_bool:
        result = 0.0
    elif employee.marital in ['divorced', 'single', 'widower'] or (employee.marital in ['married', 'cohabitant'] and employee.spouse_fiscal_status == 'without_income'):
        if 0.01 <= wage <= 1095.09:
            result = 0.0
        elif 1095.10 <= wage <= 1945.38:
            result = 0.0
        elif 1945.39 <= wage <= 2190.18:
            result = -min((wage - 1945.38) * 0.076, 18.60)
        elif 2190.19 <= wage <= 6038.82:
            result = -min(18.60 + (wage - 2190.18) * 0.011, 60.94)
        else:
            result = -60.94
    elif employee.marital in ['married', 'cohabitant'] and employee.spouse_fiscal_status != 'without_income':
        if 0.01 <= wage <= 1095.09:
            result = 0.0
        elif 1095.10 <= wage <= 1945.38:
            result = -9.30
        elif 1945.39 <= wage <= 2190.18:
            result = -min(max((wage - 1945.38) * 0.076, 9.30), 18.60)
        elif 2190.19 <= wage <= 6038.82:
            result = -min(18.60 + (wage - 2190.18) * 0.011, 51.64)
        else:
            result = -51.64
    return result

# ref: https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/deductions/workers_reductions/workbonus.html
def compute_employment_bonus_employees_commissions(payslip, categories, worked_days, inputs):
    bonus_basic_amount = payslip.rule_parameter('work_bonus_basic_amount')
    wage_lower_bound = payslip.rule_parameter('work_bonus_reference_wage_low')
    ratio = 1

    if payslip.worked_days_line_ids:
        rc = payslip.contract_id.resource_calendar_id
        worked_hours = sum(payslip.worked_days_line_ids.mapped('number_of_hours'))
        if not rc.full_time_required_hours or not rc.hours_per_day:
            ratio = 0
        else:
            full_time_hours = sum(payslip.worked_days_line_ids.mapped('number_of_days')) * rc.full_time_required_hours / (rc.full_time_required_hours / rc.hours_per_day)
            ratio = worked_hours / full_time_hours

    salary = categories.BASIC * ratio
    adjusted_onss = -categories.BASIC * 0.1307

    if salary <= wage_lower_bound:
        result = bonus_basic_amount
    elif salary <= payslip.rule_parameter('work_bonus_reference_wage_high'):
        coeff = payslip.rule_parameter('work_bonus_coeff')
        result = bonus_basic_amount - (coeff * (salary - wage_lower_bound))
    else:
        return -adjusted_onss * ratio
    return min(result, -adjusted_onss) * ratio

def compute_withholding_reduction_commissions(payslip, categories, worked_days, inputs):
    if categories.EmpBonus:
        adjusted_pp = compute_withholding_taxes_adjustment(payslip, categories, worked_days, inputs)
        return min(abs(adjusted_pp), categories.EmpBonus * 0.3314)
    return 0.0
