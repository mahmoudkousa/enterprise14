# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from datetime import datetime

from odoo.tests.common import Form
from .common import TestCommonPlanning


class TestPlanningHr(TestCommonPlanning):
    @classmethod
    def setUpClass(cls):
        super(TestPlanningHr, cls).setUpClass()
        cls.setUpEmployees()

    def test_change_default_planning_role(self):
        self.assertFalse(self.employee_joseph.default_planning_role_id, "Joseph should have no default planning role")
        self.assertFalse(self.employee_joseph.planning_role_ids, "Joseph should have no planning roles")

        role_a = self.env['planning.role'].create({
            'name': 'role a'
        })
        role_b = self.env['planning.role'].create({
            'name': 'role b'
        })

        self.employee_joseph.default_planning_role_id = role_a

        self.assertEqual(self.employee_joseph.default_planning_role_id, role_a, "Joseph should have role a as default role")
        self.assertTrue(role_a in self.employee_joseph.planning_role_ids, "role a should be added to his planning roles")

        self.employee_joseph.write({'planning_role_ids': [(5, 0, 0)]})
        self.assertTrue(role_a in self.employee_joseph.planning_role_ids, "role a should be automatically added to his planning roles")

        self.employee_joseph.default_planning_role_id = role_b
        self.assertTrue(role_a in self.employee_joseph.planning_role_ids, "role a should still be in planning roles")
        self.assertTrue(role_b in self.employee_joseph.planning_role_ids, "role b should be added to planning roles")
