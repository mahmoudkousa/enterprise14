# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    ingenico_payment_terminal = fields.Boolean(string="Ingenico Payment Terminal", config_parameter='pos_iot.ingenico_payment_terminal')

    def set_values(self):
        super(ResConfigSettings, self).set_values()
        payment_methods = self.env['pos.payment.method']
        if not self.env['ir.config_parameter'].sudo().get_param('pos_iot.ingenico_payment_terminal'):
            payment_methods |= payment_methods.search([('use_payment_terminal', '=', 'ingenico')])
        payment_methods.write({'use_payment_terminal': False, 'iot_device_id': False})
