# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from datetime import datetime


class HrContract(models.Model):
    _inherit = 'hr.contract'


    def _generate_work_entries(self, date_start, date_stop):
        if self.env.context.get('force_work_entry_generation'):
            date_start = fields.Datetime.to_datetime(date_start)
            date_stop = datetime.combine(fields.Datetime.to_datetime(date_stop), datetime.max.time())

            vals_list = []
            for contract in self:
                contract_start = fields.Datetime.to_datetime(contract.date_start)
                contract_stop = datetime.combine(fields.Datetime.to_datetime(contract.date_end or datetime.max.date()),
                                                 datetime.max.time())
                date_start_work_entries = max(date_start, contract_start)
                date_stop_work_entries = min(date_stop, contract_stop)
                vals_list += contract._get_work_entries_values(date_start_work_entries, date_stop_work_entries)

            if not vals_list:
                return self.env['hr.work.entry']
            return self.env['hr.work.entry'].create(vals_list)
        return super()._generate_work_entries(date_start, date_stop)
