# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import AccessError


class SpreadsheetTemplate(models.Model):
    _name = 'spreadsheet.template'
    _description= "Spreadsheet Template"
    _order = "sequence"

    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=100)
    data = fields.Binary(required=True)
    thumbnail = fields.Binary()

    def copy(self, default=None):
        self.ensure_one()
        chosen_name = default.get('name') if default else None
        new_name = chosen_name or _('%s (copy)', self.name)
        default = dict(default or {}, name=new_name)
        return super().copy(default)

    def check_spreadsheet_access(self, operation: str, *, raise_exception=True):
        try:
            self.check_access_rights(operation)
            self.check_access_rule(operation)
        except AccessError as e:
            if raise_exception:
                raise e
            return False
        return True
