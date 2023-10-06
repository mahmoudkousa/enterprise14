# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.exceptions import NotFound

from odoo import http
from odoo.http import request
from odoo.addons.http_routing.models.ir_http import slug
from odoo.addons.website_event.controllers.main import WebsiteEventController


class WebsiteEventTwitterWallController(WebsiteEventController):
    @http.route([
        '/event/<model("event.event"):event>/social',
        '/event/<model("event.event"):event>/social/page/<int:page>'
    ], type='http', auth="public", website=True, sitemap=False)
    def event_social(self, event, page=1):
        if not event.can_access_from_current_website():
            raise NotFound()

        tweets_count = 15
        wall = event.twitter_wall_id
        pager = request.website.pager(url='/event/%s/social' % slug(event), total=wall.total_tweets, page=page, step=tweets_count, scope=tweets_count)
        tweets = request.env['website.twitter.tweet'].search([('wall_ids', 'in', wall.id)], limit=tweets_count, offset=pager['offset'], order='id desc')
        return request.render('website_event_twitter_wall.event_twitter_wall_view', {
            'main_object': event,
            'event': event,
            'wall': wall,
            'tweets': tweets,
            'pager': pager
        })
