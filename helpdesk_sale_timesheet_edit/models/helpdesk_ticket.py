# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class HelpdeskTicket(models.Model):
    _inherit = 'helpdesk.ticket'

    def _search_sol_in_timesheets(self):
        # Override of the _search_sol_in_timesheets in helpdesk_sale_timesheet module
        # TODO: [XBO] remove me in master when the sale_line_id field in ticket is stored
        self.ensure_one()
        if not self.timesheet_ids:
            return False
        timesheets = self.timesheet_ids.filtered(lambda t: not t.is_so_line_edited)
        sale_lines = timesheets.mapped('so_line')
        if sale_lines and len(sale_lines) == 1 and sale_lines.exists() and sale_lines.sudo().order_partner_id.commercial_partner_id == self.commercial_partner_id:
            return sale_lines
        determined_sol_ids = [t._timesheet_determine_sale_line(t.task_id, t.employee_id, t.project_id).id for t in timesheets]
        candidat_sols = sale_lines.filtered(lambda sol: sol.id not in determined_sol_ids)
        return len(candidat_sols) == 1 and candidat_sols  # return the sol if only one SOL is in the variable or return False
