# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class DemoSocialStreamPost(models.Model):
    """ Mostly contains methods that return 'mock' data for the comments feature. """

    _inherit = 'social.stream.post'

    def _like_facebook_object(self, object_id, like):
        """ Overridden to bypass third-party API calls. """
        pass

    def get_facebook_comments(self, next_records_token=False):
        return {
            'comments': self._get_demo_comments(),
            'summary': {'totalCount': 1}
        }

    def get_twitter_comments(self):
        return {
            'comments': self._get_demo_comments()
        }

    def get_linkedin_comments(self, comment_urn=None, offset=0, count=20):
        if comment_urn:
            comments = self._get_demo_sub_comments()
        else:
            comments = self._get_demo_comments()

        for comment in comments:
            comment['id'] = 'urn:li:comment:(urn:li:activity:12547,452542)'

            if 'comments' in comment:
                comment['comments']['data'] = {
                    'length': len(comment['comments']['data']),
                    'parentUrn': comment['id'],
                }

        return {
            'comments': comments,
            'summary': {'totalCount': len(comments)}
        }

    def delete_linkedin_comment(self, comment_urn):
        pass

    def _add_linkedin_comment(self, message, comment_urn=None):
        return {}

    def _get_new_comment_demo(self, message):
        return {
            'id': 5,
            'formatted_created_time': '10/02/2019',
            'likes': {'summary': {'total_count': 0}},
            'from': {
                'name': 'Mitchell Admin',
                'profile_image_url_https': '/web/image/res.users/2/image_128'
            },
            'message': message
        }

    def _get_new_linkedin_comment_demo(self, message):
        return {
            'id': 'urn:li:comment:(urn:li:activity:12547,452542)',
            'formatted_created_time': '10/02/2019',
            'likes': {'summary': {'total_count': 0}},
            'from': {
                'name': 'Mitchell Admin',
                'profile_image_url_https': '/web/image/res.users/2/image_128',
                'authorUrn': 'urn:li:organization:2414183',
            },
            'message': message
        }

    def _get_demo_comments(self):
        """ Return some fake comments. """

        res_partner_2 = self.env.ref('social_demo.res_partner_2', raise_if_not_found=False)
        res_partner_3 = self.env.ref('social_demo.res_partner_3', raise_if_not_found=False)
        res_partner_4 = self.env.ref('social_demo.res_partner_4', raise_if_not_found=False)
        res_partner_10 = self.env.ref('social_demo.res_partner_10', raise_if_not_found=False)

        if not all(res_partner for res_partner in [res_partner_2, res_partner_3, res_partner_4, res_partner_10]):
            return []

        return [{
            'id': 1,
            'formatted_created_time': '10/02/2019',
            'likes': {'summary': {'total_count': 53}},
            'from': {
                'name': 'The Jackson Group',
                'profile_image_url_https': '/web/image/res.partner/%s/image_128' % res_partner_10.id,
                'id': 'urn:li:organization:2414183',
            },
            'message': 'Great products!',
            'user_likes': True,
            'comments': {'data': self._get_demo_sub_comments()},
        }, {
            'id': 2,
            'formatted_created_time': '09/02/2019',
            'likes': {'summary': {'total_count': 4}},
            'from': {
                'name': 'Deco Addict',
                'profile_image_url_https': '/web/image/res.partner/%s/image_128' % res_partner_2.id,
                'id': 'urn:li:organization:2414183',
            },
            'message': 'Can I get in touch with one of your salesman?',
            'user_likes': True
        }]

    def _get_demo_sub_comments(self):
        res_partner_2 = self.env.ref('social_demo.res_partner_2', raise_if_not_found=False)
        res_partner_3 = self.env.ref('social_demo.res_partner_3', raise_if_not_found=False)
        res_partner_4 = self.env.ref('social_demo.res_partner_4', raise_if_not_found=False)
        res_partner_10 = self.env.ref('social_demo.res_partner_10', raise_if_not_found=False)

        if not all(res_partner for res_partner in [res_partner_2, res_partner_3, res_partner_4, res_partner_10]):
            return []

        return [{
            'id': 3,
            'formatted_created_time': '10/02/2019',
            'likes': {'summary': {'total_count': 21}},
            'from': {
                'name': 'Ready Mat',
                'profile_image_url_https': '/web/image/res.partner/%s/image_128' % res_partner_4.id,
                'authorUrn': 'urn:li:organization:2414183',
            },
            'message': 'I agree!'
        }, {
            'id': 4,
            'formatted_created_time': '10/02/2019',
            'likes': {'summary': {'total_count': 13}},
            'from': {
                'name': 'Gemini Furniture',
                'profile_image_url_https': '/web/image/res.partner/%s/image_128' % res_partner_3.id,
                'authorUrn': 'urn:li:organization:2414183',
            },
            'message': 'Me too ❤️'
        }]
