# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class ProjectTaskCreateTimesheet(models.TransientModel):
    _inherit = 'project.task.create.timesheet'

    def save_timesheet(self):
        timesheet = super().save_timesheet()
        self.task_id.user_timer_id.unlink()
        return timesheet
