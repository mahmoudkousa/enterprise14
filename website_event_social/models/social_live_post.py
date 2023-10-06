# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class SocialLivePostEvent(models.Model):
    _inherit = 'social.live.post'

    def _post(self):
        """ This override allows sending push notifications immediately by passing a 'force_send '
        context key.
        Otherwise, they are sent by the CRON on scheduled social posts (see base method docstring). """

        push_notifications_live_posts = self.filtered(lambda post: post.account_id.media_type == 'push_notifications')
        super(SocialLivePostEvent, (self - push_notifications_live_posts))._post()

        if self.env.context.get('force_send'):
            push_notifications_live_posts.write({
                'state': 'posting'
            })
            push_notifications_live_posts._post_push_notifications()
        else:
            super(SocialLivePostEvent, push_notifications_live_posts)._post()
