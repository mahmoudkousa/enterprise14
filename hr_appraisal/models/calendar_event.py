# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class CalendarEvent(models.Model):
    """ Model for Calendar Event """
    _inherit = 'calendar.event'

    @api.model_create_multi
    def create(self, vals_list):
        events = super().create(vals_list)
        for event in events:
            if event.res_model == 'hr.appraisal':
                appraisal = self.env['hr.appraisal'].browse(event.res_id)
                if appraisal.exists():
                    appraisal.write({
                        'meeting_id': event.id,
                        'date_final_interview': event.start_date if event.allday else event.start
                    })
        return events
