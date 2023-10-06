# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _


class HrContract(models.Model):
    _inherit = 'hr.contract'

    l10n_be_impulsion_plan = fields.Selection([
        ('25yo', '< 25 years old'),
        ('12mo', '12 months +'),
        ('55yo', '55+ years old')], string="Impulsion Plan")
