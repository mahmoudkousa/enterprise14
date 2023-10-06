# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class SocialPostEvent(models.Model):
    _inherit = "social.post"

    def action_post_immediate(self):
        self.with_context({'force_send': True}).action_post()
