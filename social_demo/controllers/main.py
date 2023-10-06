# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.addons.social_facebook.controllers.main import SocialFacebookController
from odoo.addons.social_twitter.controllers.main import SocialTwitterController
from odoo.addons.social_linkedin.controllers.main import SocialLinkedin

from odoo import http
from odoo.http import request


class DemoSocialFacebookController(SocialFacebookController):
    @http.route(['/social_facebook/comment'], type='http', auth='user')
    def add_comment(self, post_id=None, message=None, comment_id=None, existing_attachment_id=None, is_edit=False, **kwargs):
        """ Returns a fake comment containing the passed 'message' """
        return json.dumps(request.env['social.stream.post']._get_new_comment_demo(message))


class DemoSocialTwitterController(SocialTwitterController):
    @http.route('/social_twitter/<int:stream_id>/comment', type='http')
    def comment(self, stream_id=None, post_id=None, comment_id=None, message=None, **kwargs):
        """ Returns a fake comment containing the passed 'message' """
        return json.dumps(request.env['social.stream.post']._get_new_comment_demo(message))

    @http.route('/social_twitter/<int:stream_id>/like_tweet', type='json')
    def like_tweet(self, stream_id, tweet_id, like):
        pass


class DemoSocialLinkedInController(SocialLinkedin):
    @http.route(['/social_linkedin/comment'], type='http', auth='user')
    def add_comment(self, post_id=None, message=None, comment_id=None, is_edit=False, **kwargs):
        """ Returns a fake comment containing the passed 'message' """
        return json.dumps(request.env['social.stream.post']._get_new_linkedin_comment_demo(message))
