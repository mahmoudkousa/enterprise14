# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_project_forecast_display_allocate_time = fields.Boolean(
        string="Allocated Time Percentage",
        implied_group='project_forecast.group_project_forecast_display_allocate_time')
