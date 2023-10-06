# -*- coding: utf-8 -*-

from odoo import _, http
from odoo.exceptions import ValidationError

from odoo.addons.website_sale.controllers.main import WebsiteSale

class WebsiteSale(WebsiteSale):

    def _get_shop_payment_values(self, order, **kwargs):
        res = {}
        res['on_payment_step'] = True

        if order.fiscal_position_id.is_taxcloud:
            try:
                order.validate_taxes_on_sales_order()
            except ValidationError:
                res.setdefault('errors', []).append((_("Validation Error"), _("This address does not appear to be valid. Please make sure it has been filled in correctly.")))

        res.update(super(WebsiteSale, self)._get_shop_payment_values(order, **kwargs))
        return res

    @http.route()
    def payment_transaction(self, acquirer_id, so_id=None, access_token=None, **kwargs):
        """
        Recompute taxcloud sales before payment
        """
        if so_id:
            env = http.request.env['sale.order']
            domain = [('id', '=', so_id)]
            if access_token:
                env = env.sudo()
                domain.append(('access_token', '=', access_token))
            order = env.search(domain, limit=1)
        else:
            order = http.request.website.sale_get_order()

        if order:
            order.validate_taxes_on_sales_order()

        return super().payment_transaction(acquirer_id, so_id=so_id,
                                    access_token=access_token, **kwargs)
