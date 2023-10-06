# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Company(models.Model):
    _inherit = "res.company"

    # TODO: to remove in Master.
    keyboard_layout = fields.Selection([
        ('qwerty', "QWERTY Keyboard"),
        ('azerty', "AZERTY Keyboard"),
        ('alphabetical', "Display Alphabetically"),
    ], string='Keyboard Layout', default='qwerty', required=True, help="Desired order for keyboard shortcuts to appear in.")
