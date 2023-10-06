#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, datetime, time
from json import JSONEncoder

from odoo import fields, models

BROWSABLE_OBJECT_SAFE_CLASSES = (models.BaseModel, set, datetime, date, time)

class ValueChecker(JSONEncoder):
    def default(self, value):
        if isinstance(value, BROWSABLE_OBJECT_SAFE_CLASSES):
            return repr(value)
        return super().default(value)

    def check(self, value):
        self.encode(value)

valueChecker = ValueChecker()

class BrowsableObject(object):
    def __init__(self, employee_id, dict, env):
        self.employee_id = employee_id
        self.dict = dict
        self.env = env

    def __getattr__(self, attr):
        value = None
        if attr in self.dict:
            value = self.dict.__getitem__(attr)
            valueChecker.check(value)
        return value or 0.0

    def __getitem__(self, key):
        return self.dict[key] or 0.0

class ResultRules(BrowsableObject):
    def __getattr__(self, attr):
        return attr in self.dict and self.dict.__getitem__(attr) or {'total': 0, 'amount': 0, 'quantity': 0}

    def __getitem__(self, key):
        return self.dict[key] if key in self.dict else {'total': 0, 'amount': 0, 'quantity': 0}

class InputLine(BrowsableObject):
    """a class that will be used into the python code, mainly for usability purposes"""
    def sum(self, code, from_date, to_date=None):
        if to_date is None:
            to_date = fields.Date.today()
        self.env.cr.execute("""
            SELECT sum(amount) as sum
            FROM hr_payslip as hp, hr_payslip_input as pi
            WHERE hp.employee_id = %s AND hp.state = 'done'
            AND hp.date_from >= %s AND hp.date_to <= %s AND hp.id = pi.payslip_id AND pi.code = %s""",
            (self.employee_id, from_date, to_date, code))
        return self.env.cr.fetchone()[0] or 0.0

class WorkedDays(BrowsableObject):
    """a class that will be used into the python code, mainly for usability purposes"""
    def _sum(self, code, from_date, to_date=None):
        if to_date is None:
            to_date = fields.Date.today()
        self.env.cr.execute("""
            SELECT sum(number_of_days) as number_of_days, sum(number_of_hours) as number_of_hours
            FROM hr_payslip as hp, hr_payslip_worked_days as pi
            WHERE hp.employee_id = %s AND hp.state = 'done'
            AND hp.date_from >= %s AND hp.date_to <= %s AND hp.id = pi.payslip_id AND pi.work_entry_type_id IN (SELECT id FROM hr_work_entry_type WHERE code = %s)""",
            (self.employee_id, from_date, to_date, code))
        return self.env.cr.fetchone()

    def sum(self, code, from_date, to_date=None):
        res = self._sum(code, from_date, to_date)
        return res and res[0] or 0.0

    def sum_hours(self, code, from_date, to_date=None):
        res = self._sum(code, from_date, to_date)
        return res and res[1] or 0.0

class Payslips(BrowsableObject):
    """a class that will be used into the python code, mainly for usability purposes"""

    def sum(self, code, from_date, to_date=None):
        if to_date is None:
            to_date = fields.Date.today()
        self.env.cr.execute("""SELECT sum(case when hp.credit_note IS NOT TRUE then (pl.total) else (-pl.total) end)
                    FROM hr_payslip as hp, hr_payslip_line as pl
                    WHERE hp.employee_id = %s AND hp.state = 'done'
                    AND hp.date_from >= %s AND hp.date_to <= %s AND hp.id = pl.slip_id AND pl.code = %s""",
                    (self.employee_id, from_date, to_date, code))
        res = self.env.cr.fetchone()
        return res and res[0] or 0.0

    def rule_parameter(self, code):
        return self.env['hr.rule.parameter']._get_parameter_from_code(code, self.dict.date_to)

    def sum_category(self, code, from_date, to_date=None):
        if to_date is None:
            to_date = fields.Date.today()

        self.env['hr.payslip'].flush(['credit_note', 'employee_id', 'state', 'date_from', 'date_to'])
        self.env['hr.payslip.line'].flush(['total', 'slip_id', 'category_id'])
        self.env['hr.salary.rule.category'].flush(['code'])

        self.env.cr.execute("""SELECT sum(case when hp.credit_note is not True then (pl.total) else (-pl.total) end)
                    FROM hr_payslip as hp, hr_payslip_line as pl, hr_salary_rule_category as rc
                    WHERE hp.employee_id = %s AND hp.state = 'done'
                    AND hp.date_from >= %s AND hp.date_to <= %s AND hp.id = pl.slip_id
                    AND rc.id = pl.category_id AND rc.code = %s""",
                    (self.employee_id, from_date, to_date, code))
        res = self.env.cr.fetchone()
        return res and res[0] or 0.0

    @property
    def paid_amount(self):
        return self.dict._get_paid_amount()
