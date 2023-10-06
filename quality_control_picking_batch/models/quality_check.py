# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class QualityCheck(models.Model):
    _inherit = "quality.check"

    batch_id = fields.Many2one(related='picking_id.batch_id')

    def redirect_after_pass_fail(self):
        res = super().redirect_after_pass_fail()
        if res and res.get('type') == 'ir.actions.act_window_close' and self[0].batch_id:
            return self[0].batch_id.action_open_quality_check()
        return res

    def redirect_after_failure(self):
        res = super().redirect_after_failure()
        if res and res.get('type') == 'ir.actions.act_window_close' and self[0].batch_id:
            return self[0].batch_id.action_open_quality_check()
        return res
