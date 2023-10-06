# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import uuid

from odoo import _, models

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = "res.partner"

    def _handle_ebay_account_deletion_notification(self):
        """Handle account deletion notification from ebay, concerning current partners"""
        # Remove access to the portal
        linked_users = self.env['res.users'].sudo().search([
            ('partner_id', 'in', self.ids),
            ('groups_id', 'in', [self.env.ref('base.group_portal').id])
        ])
        if linked_users:
            try:
                linked_users.write({'active': False})
            except Exception as e:
                _logger.error(
                    "eBay account deletion request: couldn't archive portal users: %s (ids: %s)",
                    ", ".join(linked_users.mapped('name')),
                    ", ".join(linked_users.ids))

        # Notify Admin user of potentially remaining private data
        try:
            self._ebay_account_deletion_notify_admin()
        except Exception as e:
            _logger.error("eBay account deletion request: couldn't assign activity to admin user: %s", e)

        # Anonymize partner information (including delivery addresses)
        try:
            self._anonymize_ebay_partner()
            _logger.info(
                "Ebay account deletion request: successful anonymization for %i partners (ids: %s)",
                len(self),
                ", ".join(str(self.ids)))
        except Exception as e:
            _logger.error("eBay: Couldn't anonymise partners (ids: %s): %s", self.ids, e)

    def _ebay_account_deletion_notify_admin(self):
        """ Notify the db admin of an eBay Marketplace Account Deletion/Closure

        :return: None
        """
        admin_user = self.env['res.users'].sudo().search([
            ('groups_id', 'in', [self.env.ref('base.group_system').id])
        ], limit=1)
        for partner in self:
            partner.activity_schedule(
                'sale_ebay_account_deletion.ebay_GDPR_notification',
                note=_(
                    "This is an automated notification as a deletion request has been received "
                    "from eBay concerning the account \"%s (%s)\". "
                    "The account has been anonymised already and his portal access revoked (if they had any)."
                    "\n\n"
                    "However, personal information might remain in linked documents, "
                    "please review them according to laws that apply.",
                ) % (partner.name, partner.id),
                user_id=admin_user.id,
            )

    def _anonymize_ebay_partner(self, archive=False):
        """ Remove all data sent by eBay from the partner

        Remove access to the portal, replace the name with a UUID as a placeholder and delete all
        other data, including children that have the type 'delivery'.

        :param bool archive: Archive self records if True

        :return: anonymized partners
        """
        if not self:
            return self

        # Archive children addresses
        delivery_children = self.child_ids.filtered(lambda p: p.type == 'delivery' and p.id not in self.ids)
        if delivery_children:
            delivery_children._anonymize_ebay_partner(archive=True)

        # Delete data delivered by eBay
        partner_data = {
            'name': uuid.uuid4(),
            'ebay_id': '',
            'ref': '',
            'email': '',
            'street': '',
            'street2': '',
            'city': '',
            'zip': '',
            'phone': '',
            'state_id': False,
            'country_id': False,
        }
        if archive:
            # Do not archive the main partner otherwise the generated activity
            # is invisible to the targeted admin.
            partner_data['active'] = False

        self.write(partner_data)
        return (self | delivery_children) if delivery_children else self
