# -*- coding: utf-8 -*-

from odoo import api, fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    barcode_nomenclature_id = fields.Many2one('barcode.nomenclature', related='company_id.nomenclature_id', readonly=False)
    # TODO: remove `keyboard_layout` and `group_barcode_keyboard_shortcuts` in master.
    group_barcode_keyboard_shortcuts = fields.Boolean("Keyboard Shortcuts", implied_group='stock_barcode.group_barcode_keyboard_shortcuts')
    keyboard_layout = fields.Selection(related="company_id.keyboard_layout", default='qwerty', string="Keyboard Layout", readonly=False)
    stock_barcode_demo_active = fields.Boolean("Demo Data Active", compute='_compute_stock_barcode_demo_active')

    @api.depends('company_id')
    def _compute_stock_barcode_demo_active(self):
        for rec in self:
            rec.stock_barcode_demo_active = bool(self.env['ir.module.module'].search([('name', '=', 'stock_barcode'), ('demo', '=', True)]))
