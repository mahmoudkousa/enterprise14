# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import http
from odoo.addons.sale_subscription.controllers.portal import sale_subscription

class sale_subscription_avatax(sale_subscription):
    @http.route()
    def subscription(self, account_id, uuid='', message='', message_class='', **kw):
        response = super().subscription(account_id, uuid=uuid, message=message, message_class=message_class, **kw)

        if 'account' not in response.qcontext:
            return response

        sub = response.qcontext['account']
        if sub.is_avatax:
            sub.button_update_avatax()

        return response
