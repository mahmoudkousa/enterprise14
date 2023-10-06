# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.addons.account_inter_company_rules.tests.common import TestInterCompanyRulesCommon


class TestInterCompanyRulesCommonSOPO(TestInterCompanyRulesCommon):

    @classmethod
    def setUpClass(cls):
        super(TestInterCompanyRulesCommonSOPO, cls).setUpClass()
        # Set warehouse on company A
        cls.company_a.warehouse_id = cls.env['stock.warehouse'].search([('company_id', '=', cls.company_a.id)])

        # Set warehouse on company B
        cls.company_b.warehouse_id = cls.env['stock.warehouse'].search([('company_id', '=', cls.company_b.id)])
