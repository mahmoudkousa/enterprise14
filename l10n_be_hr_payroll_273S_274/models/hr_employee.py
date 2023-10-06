# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    # TODO MASTER: Add this in the salary package personal infos
    certificate = fields.Selection(selection_add=[('civil_engineer', 'Master: Civil Engineering')])
