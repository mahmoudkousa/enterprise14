# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Project(models.Model):
    _inherit = "project.project"

    allow_material = fields.Boolean("Products on Tasks", compute="_compute_allow_material", store=True, readonly=False)
    allow_quotations = fields.Boolean(
        "Extra Quotations", compute="_compute_allow_quotations", store=True, readonly=False)
    allow_billable = fields.Boolean(store=True, readonly=False, compute='_compute_allow_billable')
    bill_type = fields.Selection(compute="_compute_bill_type", store=True, readonly=False)
    sale_line_id = fields.Many2one(compute="_compute_sale_line_id", store=True, readonly=False)

    _sql_constraints = [
        ('material_imply_billable', "CHECK((allow_material = 't' AND allow_billable = 't') OR (allow_material = 'f'))", 'The material can be allowed only when the task can be billed.'),
        ('fsm_imply_task_rate', "CHECK((is_fsm = 't' AND sale_line_id IS NULL) OR (is_fsm = 'f'))", 'An FSM project must be billed at task rate.'),
    ]

    @api.model
    def default_get(self, fields_list):
        defaults = super().default_get(fields_list)
        if 'allow_quotations' in fields_list and 'allow_quotations' not in defaults and defaults.get('is_fsm'):
            defaults['allow_quotations'] = self.env.user.has_group('industry_fsm_sale.group_fsm_quotation_from_task')
        return defaults

    @api.depends('is_fsm')
    def _compute_allow_quotations(self):
        if not self.env.user.has_group('industry_fsm_sale.group_fsm_quotation_from_task'):
            self.allow_quotations = False
        else:
            for project in self:
                project.allow_quotations = project.is_fsm

    @api.depends('is_fsm')
    def _compute_allow_billable(self):
        fsm_projects = self.filtered('is_fsm')
        fsm_projects.allow_billable = True

    @api.depends('allow_billable', 'is_fsm')
    def _compute_allow_material(self):
        for project in self:
            if not project._origin:
                project.allow_material = project.is_fsm and project.allow_billable
            else:
                project.allow_material = project.allow_billable

    def flush(self, fnames=None, records=None):
        if fnames is not None:
            # force 'allow_billable' and 'allow_material' to be flushed
            # altogether in order to satisfy the SQL constraint above
            fnames = set(fnames)
            if 'allow_billable' in fnames or 'allow_material' in fnames:
                fnames.add('allow_billable')
                fnames.add('allow_material')
        return super().flush(fnames, records)

    @api.depends('is_fsm')
    def _compute_bill_type(self):
        self.filtered(lambda p: p.is_fsm).update({'bill_type': 'customer_task'})

    @api.depends('is_fsm')
    def _compute_sale_line_id(self):
        # We cannot have a SOL in the fsm project
        self.filtered(lambda p: p.is_fsm).update({'sale_line_id': False})
