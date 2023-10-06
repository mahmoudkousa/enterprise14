# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class User(models.Model):
    _inherit = ['res.users']

    next_appraisal_date = fields.Date(related='employee_id.next_appraisal_date')
    last_appraisal_date = fields.Date(related='employee_id.last_appraisal_date')
    last_appraisal_id = fields.Many2one(related='employee_id.last_appraisal_id')

    def __init__(self, pool, cr):
        """ Override of __init__ to add access rights.
            Access rights are disabled by default, but allowed
            on some specific fields defined in self.SELF_{READ/WRITE}ABLE_FIELDS.
        """
        appraisal_readable_fields = [
            'next_appraisal_date',
            'last_appraisal_date',
            'last_appraisal_id',
        ]
        init_res = super(User, self).__init__(pool, cr)
        # duplicate list to avoid modifying the original reference
        type(self).SELF_READABLE_FIELDS = appraisal_readable_fields + type(self).SELF_READABLE_FIELDS
        return init_res

    def action_send_appraisal_request(self):
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'request.appraisal',
            'target': 'new',
            'name': 'Appraisal Request',
            'context': self.env.context,
        }
