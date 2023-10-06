# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class GenerateSimulationLink(models.TransientModel):
    _inherit = 'generate.simulation.link'

    contract_type = fields.Selection([
        ('PFI', 'PFI'),
        ('CDI', 'CDI'),
        ('CDD', 'CDD')], string="Contract Type", default="CDI")

    def _get_url_triggers(self):
        res = super()._get_url_triggers()
        return res + ['contract_type']
