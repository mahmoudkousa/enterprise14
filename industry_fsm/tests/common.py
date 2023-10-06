# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo.tests.common import SingleTransactionCase


class TestFsmFlowCommon(SingleTransactionCase):

    @classmethod
    def setUpClass(cls):
        super(TestFsmFlowCommon, cls).setUpClass()

        cls.project_user = cls.env['res.users'].create({
            'name': 'Armande Project_user',
            'login': 'Armande',
            'email': 'armande.project_user@example.com',
            'groups_id': [(6, 0, [cls.env.ref('project.group_project_user').id])]
        })

        cls.fsm_project = cls.env.ref('industry_fsm.fsm_project')
