# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.osv.expression import AND


class QualityPoint(models.Model):
    _inherit = "quality.point"

    @api.model
    def _get_domain_for_production(self, quality_points_domain):
        quality_points_domain = super()._get_domain_for_production(quality_points_domain)
        return AND([quality_points_domain, [('operation_id', '=', False)]])


class QualityCheck(models.Model):
    _inherit = "quality.check"

    def _get_check_result(self):
        if self.test_type == 'passfail':
            return _('Success') if self.quality_state == 'pass' else _('Failure')
        elif self.test_type == 'measure':
            return '{} {}'.format(self.measure, self.norm_unit)
        return super(QualityCheck, self)._get_check_result()

    def redirect_after_pass_fail(self):
        self.ensure_one()
        action = super(QualityCheck, self).redirect_after_pass_fail()
        checks = False
        if self.production_id and not self.workorder_id:
            checks = self.production_id.check_ids.filtered(lambda x: x.quality_state == 'none')
        if self.workorder_id:
            checks = self.workorder_id.check_ids.filtered(lambda x: x.quality_state == 'none')
        if checks:
            action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_check_action_small")
            action['res_id'] = checks.ids[0]
            return action
        else:
            return action
