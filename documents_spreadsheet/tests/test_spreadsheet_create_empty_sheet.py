# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest.mock import patch

import odoo
from odoo.tests import tagged
from odoo.tests.common import HttpCase


@tagged('post_install', '-at_install')
class TestSpreadsheetCreateEmpty(HttpCase):

    def test_01_spreadsheet_create_empty(self):
        self.start_tour('/web', 'spreadsheet_create_empty_sheet', login='admin')
