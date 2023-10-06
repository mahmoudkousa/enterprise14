# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    module_industry_fsm_report = fields.Boolean("Worksheets")
    module_industry_fsm_sale = fields.Boolean('Time and Material')

    def _get_subtasks_projects_domain(self):
        return [('is_fsm', '=', False)]
