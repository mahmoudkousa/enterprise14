# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.tools.float_utils import float_compare


class HrPayslipWorkedDays(models.Model):
    _inherit = 'hr.payslip.worked_days'

    @api.depends('is_paid', 'is_credit_time', 'number_of_hours', 'payslip_id', 'payslip_id.normal_wage', 'payslip_id.sum_worked_hours')
    def _compute_amount(self):
        variable_salary_wd = self.filtered(lambda wd: wd.code == 'LEAVE1731')
        # For the average of the variable remuneration:
        # Taking into account the full number of months with the employer
        # Variable monthly average remuneration to be divided by 25 and increased by 20% (in 5-day regime).
        # Example: if over 7 months, the variable average monthly remuneration is € 1,212.
        # You add, to the JF, the following amount: 1212/25 = 48.48 + 20% = € 58.17.
        for wd in variable_salary_wd:
            amount = wd.payslip_id._get_last_year_average_variable_revenues()
            amount = amount / 25.0
            if not float_compare(wd.payslip_id.contract_id.resource_calendar_id.work_time_rate, 100, precision_digits=2):
                amount *= 1.2
            wd.amount = amount
        super(HrPayslipWorkedDays, self - variable_salary_wd)._compute_amount()
