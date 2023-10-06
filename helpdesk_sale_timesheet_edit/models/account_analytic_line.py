# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


# TODO: [XBO] merge with account.analytic.line in the helpdesk_sale_timesheet module in master
class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    @api.depends('task_id.sale_line_id', 'project_id.sale_line_id', 'project_id.allow_billable', 'employee_id', 'helpdesk_ticket_id.sale_line_id')
    def _compute_so_line(self):
        super(AccountAnalyticLine, self.filtered(lambda t: not t.is_so_line_edited))._compute_so_line()
