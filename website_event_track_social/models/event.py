# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, fields, models
from odoo.exceptions import AccessError


class EventTrackSocial(models.Model):
    _inherit = "event.event"

    def action_send_push_reminders(self):
        if not self.user_has_groups('social.group_social_user'):
            raise AccessError(_('You do not have access to this action.'))

        super(EventTrackSocial, self).action_send_push_reminders()

        event_posts = self.env['social.post'].search([
            ('post_method', '=', 'scheduled'),
            ('state', '=', 'scheduled'),
            ('event_track_id', 'in', self.track_ids.ids),
            ('scheduled_date', '<=', fields.Datetime.now())
        ])
        event_posts._action_post()
        push_notifications = event_posts.live_post_ids.filtered(
            lambda post:
                post.account_id.media_type == 'push_notifications' and
                post.state in ['ready', 'posting']
        )
        push_notifications.write({'state': 'posting'})
        push_notifications._post_push_notifications()
