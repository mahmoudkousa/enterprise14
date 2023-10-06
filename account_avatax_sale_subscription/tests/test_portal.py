# coding: utf-8
import contextlib

from odoo.tests.common import tagged
from odoo.addons.account_avatax_sale_subscription.controllers.portal import sale_subscription_avatax
from odoo.addons.website.tools import MockRequest
from odoo.tools import mute_logger

from .test_sale_subscription import TestSaleSubscriptionAvalaraCommon


@contextlib.contextmanager
def WebsiteSaleSubMockRequest(*args, **kwargs):
    class Response:
        def __init__(self, qcontext):
            self.qcontext = qcontext

    qcontext = kwargs.pop('qcontext')
    with MockRequest(*args, **kwargs) as request:
        request.uid = 1
        request.render = lambda self, _: Response(qcontext)
        yield request


@tagged("-at_install", "post_install")
class TestWebsiteSaleSubscriptionAvatax(TestSaleSubscriptionAvalaraCommon):
    @mute_logger('odoo.http')
    def test_01_portal_avatax_called(self):
        controller = sale_subscription_avatax()
        with WebsiteSaleSubMockRequest(self.env, qcontext={'account': self.subscription}), \
             self._capture_request({'lines': [], 'summary': []}) as capture:
            controller.subscription(self.subscription.id)

        self.assertEqual(
            capture.val and capture.val['json']['referenceCode'],
            self.subscription.name,
            'Should have queried avatax for the right taxes on the SO.'
        )
