# -*- coding: utf-8 -*-
import json
import requests
import werkzeug

from odoo import http, _
from odoo.http import request
from werkzeug.urls import url_encode
from odoo.addons.social.controllers.main import SocialValidationException


class SocialLinkedin(http.Controller):
    # ========================================================
    # Accounts management
    # ========================================================

    @http.route(['/social_linkedin/callback'], type='http', auth='user')
    def social_linkedin_callback(self, access_token=None, code=None, state=None, **kw):
        """
        We can receive
        - code directly from LinkedIn
        - access_token from IAP
        - state from LinkedIn/IAP, the state avoid the CSRF attack
        """
        if not request.env.user.has_group('social.group_social_manager'):
            return request.render('social.social_http_error_view',
                                  {'error_message': _('Unauthorized. Please contact your administrator.')})

        if kw.get('error') not in ('user_cancelled_authorize', 'user_cancelled_login'):
            if not access_token and not code:
                return request.render('social.social_http_error_view',
                                      {'error_message': _('LinkedIn did not provide a valid access token.')})

            media = request.env.ref('social_linkedin.social_media_linkedin')

            if media._compute_linkedin_csrf() != state:
                return request.render('social.social_http_error_view',
                                      {'error_message': _('There was a security issue during your request.')})

            try:
                if not access_token:
                    access_token = self._get_linkedin_access_token(code, media)

                request.env['social.account']._create_linkedin_accounts(access_token, media)

            # Both _get_linkedin_access_token and _create_linkedin_accounts may raise a SocialValidationException
            except SocialValidationException as e:
                    return request.render('social.social_http_error_view', {'error_message': str(e)})

        url_params = {
            'action': request.env.ref('social.action_social_stream_post').id,
            'view_type': 'kanban',
            'model': 'social.stream.post',
        }

        return werkzeug.utils.redirect('/web?#%s' % url_encode(url_params))

    def _get_linkedin_access_token(self, linkedin_authorization_code, media):
        """
        Take the `authorization code` and exchange it for an `access token`
        We also need the `redirect uri`

        :return: the access token
        """
        linkedin_url = 'https://www.linkedin.com/oauth/v2/accessToken'
        linkedin_app_id = request.env['ir.config_parameter'].sudo().get_param('social.linkedin_app_id')
        linkedin_client_secret = request.env['ir.config_parameter'].sudo().get_param('social.linkedin_client_secret')

        params = {
            'grant_type': 'authorization_code',
            'code': linkedin_authorization_code,
            'redirect_uri': media._get_linkedin_redirect_uri(),
            'client_id': linkedin_app_id,
            'client_secret': linkedin_client_secret
        }

        response = requests.post(linkedin_url, data=params).json()

        error_description = response.get('error_description')
        if error_description:
            raise SocialValidationException(error_description)

        return response.get('access_token')

    @http.route(['/social_linkedin/comment'], type='http', auth='user')
    def add_comment(self, post_id, message=None, comment_id=None, **kwargs):
        stream_post = request.env['social.stream.post'].browse(int(post_id))
        return json.dumps(stream_post._add_linkedin_comment(message, comment_id))
