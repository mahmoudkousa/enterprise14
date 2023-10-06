# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models


class SaleSubscription(models.Model):
    _inherit = "sale.subscription"

    def send_success_mail(self, tx, invoice):
        """Override to avoid sending the success mail before the payment is
        reconciled. It will be sent by the transaction's callback_method, which
        is called after the reconciliation.
        """
        if tx.acquirer_id.provider == 'sepa_direct_debit' and tx.state != 'done':
            pass
        else:
            return super(SaleSubscription, self).send_success_mail(tx, invoice)

    def reconcile_pending_transaction(self, tx, invoice=False):
        """Override the transaction's callback_method to send the success mail
        now that the payment is reconciled.
        """
        # We don't call super for SEPA as the transaction was already linked to the invoice in _do_payment()
        # but we still send the mail for successful payment.
        if tx.acquirer_id.provider != 'sepa_direct_debit':
            return super(SaleSubscription, self).reconcile_pending_transaction(tx, invoice=invoice)
        self.ensure_one()
        if tx.state == 'done':
            if not invoice:
                invoice = tx.invoice_ids and tx.invoice_ids[0]
            self.send_success_mail(tx, invoice)
        return True

    def _do_payment(self, payment_token, invoice, two_steps_sec=True):
        res = super(SaleSubscription, self)._do_payment(payment_token, invoice, two_steps_sec=two_steps_sec)
        for sub, tx in zip(self, res):
            if tx.acquirer_id.provider == 'sepa_direct_debit':
                if tx.state in ['pending', 'authorized', 'done']:
                    invoice.write({'ref': tx.reference, 'payment_reference': tx.reference})
                    sub.increment_period(renew=sub.to_renew)
                    sub.set_open()
                else:
                    invoice.button_cancel()
                    invoice.unlink()
        return res


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    def _compute_renewal_allowed(self):
        sepa_tx = self.filtered(lambda tx: tx.acquirer_id.provider == 'sepa_direct_debit')
        for tx in sepa_tx:
            tx.renewal_allowed = tx.state == 'pending'
        return super(PaymentTransaction, (self - sepa_tx))._compute_renewal_allowed()
