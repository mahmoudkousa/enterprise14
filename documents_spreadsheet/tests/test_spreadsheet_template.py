# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
from odoo.tests.common import TransactionCase

TEXT = base64.b64encode(bytes("TEST", 'utf-8'))

class SpreadsheetTemplate(TransactionCase):

    def test_copy_template_without_name(self):
        template = self.env["spreadsheet.template"].create({
            "data": TEXT,
            "name": "Template name",
        })
        self.assertEqual(
            template.copy().name,
            "Template name (copy)",
            "It should mention the template is a copy"
        )

    def test_copy_template_with_name(self):
        template = self.env["spreadsheet.template"].create({
            "data": TEXT,
            "name": "Template name",
        })
        self.assertEqual(
            template.copy({"name": "New Name"}).name,
            "New Name",
            "It should have assigned the given name"
        )
