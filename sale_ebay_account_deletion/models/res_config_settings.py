# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid
from werkzeug import urls

from odoo import _, api, fields, models
from odoo.exceptions import UserError

from odoo.addons.sale_ebay_account_deletion.controllers.main import EbayController


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    ebay_verification_token = fields.Char(
        string="Verification Token",
        config_parameter="sale_ebay.acc_deletion_token",
        readonly=True)
    ebay_account_deletion_endpoint = fields.Char(
        compute="_compute_ebay_account_deletion_endpoint",
        string="Marketplace account deletion notification endpoint")

    # dummy depends to ensure the field is correctly computed
    @api.depends("company_id")
    def _compute_ebay_account_deletion_endpoint(self):
        for wizard in self:
            wizard.ebay_account_deletion_endpoint = urls.url_join(
                self.env['ir.config_parameter'].sudo().get_param("web.base.url"),
                EbayController._endpoint,
            )

    def action_reset_token(self):
        if not self.ebay_prod_app_id or not self.ebay_prod_cert_id:
            raise UserError(_(
                "Please provide your ebay production keys before enabling the account deletion notifications."))

        try:
            import cryptography
        except ImportError:
            raise UserError(_(
                "The python 'cryptography' module is not installed on your server.\n"
                "It is necessary to support eBay account deletion notifications, "
                "please contact your system administrator to install it."))

        self.env['ir.config_parameter'].set_param("sale_ebay.acc_deletion_token", uuid.uuid4())
