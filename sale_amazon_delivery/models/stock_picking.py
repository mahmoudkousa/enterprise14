# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo

from odoo import _, models
from odoo.exceptions import UserError

from odoo.addons.sale_amazon_delivery import const


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    def _get_carrier_details(self):
        """ Return the carrier name and tracking number if any.

        If a carrier is set and it is not a custom carrier, search for its Amazon-formatted name. If
        it is a custom carrier or if it is not supported by Amazon, fallback on the carrier name.

        """
        self.ensure_one()

        shipper_name = None
        if self.carrier_id:
            carrier_key = self.carrier_id._get_delivery_type()  # Get the final delivery type
            if carrier_key in ('fixed', 'base_on_rule'):  # The delivery carrier is a custom one
                carrier_key = self.carrier_id.name  # Fallback on the carrier name
            carrier_key = ''.join(filter(str.isalnum, carrier_key)).lower()  # Normalize the key
            shipper_name = const.AMAZON_CARRIER_NAMES_MAPPING.get(carrier_key, self.carrier_id.name)
        return shipper_name, self.carrier_tracking_ref

    def _check_carrier_details_compliance(self):
        amazon_pickings_sudo = self.sudo().filtered(
            lambda p: p.sale_id and p.sale_id.amazon_order_ref \
                      and p.location_dest_id.usage == 'customer'
        )  # In sudo mode to read the field on sale.order
        for picking_sudo in amazon_pickings_sudo:
            carrier_sudo, carrier_tracking_ref = picking_sudo._get_carrier_details()
            if not carrier_sudo and not odoo.modules.module.current_test:
                raise UserError(_(
                    "Starting from July 2021, Amazon requires that a tracking reference is "
                    "provided with each delivery. See https://odoo.com/r/amz_tracking_ref \n"
                    "To get one, select a carrier."
                ))
            if not carrier_tracking_ref and not odoo.modules.module.current_test:
                raise UserError(_(
                    "Starting from July 2021, Amazon requires that a tracking reference is "
                    "provided with each delivery. See https://odoo.com/r/amz_tracking_ref \n"
                    "Since your chosen carrier doesn't provide a tracking reference, "
                    "please, enter one manually."
                ))
        return super()._check_carrier_details_compliance()
