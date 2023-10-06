# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrWorkEntryType(models.Model):
    _inherit = 'hr.work.entry.type'
    _description = 'HR Work Entry Type'

    _sql_constraints = [
        ('is_unforeseen_is_leave', 'check (is_unforeseen IS NOT TRUE OR (is_leave = TRUE and is_unforeseen = TRUE))', 'A unforeseen absence must be a leave.')
    ]

    is_unforeseen = fields.Boolean(default=False, string="Unforeseen Absence")
    round_days = fields.Selection([('NO', 'No Rounding'), ('HALF', 'Half Day'), ('FULL', 'Day')], string="Rounding", required=True, default='NO')
    round_days_type = fields.Selection([('HALF-UP', 'Closest'), ('UP', 'Up'), ('DOWN', 'Down')], string="Round Type", required=True, default='DOWN')
