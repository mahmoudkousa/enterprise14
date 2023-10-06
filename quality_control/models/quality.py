# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from math import sqrt
from dateutil.relativedelta import relativedelta
from datetime import datetime

import random

from odoo import api, models, fields, _
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT


class QualityPoint(models.Model):
    _inherit = "quality.point"

    failure_message = fields.Html('Failure Message')
    measure_frequency_type = fields.Selection([
        ('all', 'All Operations'),
        ('random', 'Randomly'),
        ('periodical', 'Periodically')], string="Type of Frequency",
        default='all', required=True)
    measure_frequency_value = fields.Float('Percentage')  # TDE RENAME ?
    measure_frequency_unit_value = fields.Integer('Frequency Unit Value')  # TDE RENAME ?
    measure_frequency_unit = fields.Selection([
        ('day', 'Days'),
        ('week', 'Weeks'),
        ('month', 'Months')], default="day")  # TDE RENAME ?
    norm = fields.Float('Norm', digits='Quality Tests')  # TDE RENAME ?
    tolerance_min = fields.Float('Min Tolerance', digits='Quality Tests')
    tolerance_max = fields.Float('Max Tolerance', digits='Quality Tests')
    norm_unit = fields.Char('Norm Unit', default=lambda self: 'mm')  # TDE RENAME ?
    average = fields.Float(compute="_compute_standard_deviation_and_average")
    standard_deviation = fields.Float(compute="_compute_standard_deviation_and_average")

    def _compute_standard_deviation_and_average(self):
        # The variance and mean are computed by the Welford’s method and used the Bessel's
        # correction because are working on a sample.
        for point in self:
            if point.test_type != 'measure':
                point.average = 0
                point.standard_deviation = 0
                continue
            mean = 0.0
            s = 0.0
            n = 0
            for check in point.check_ids.filtered(lambda x: x.quality_state != 'none'):
                n += 1
                delta = check.measure - mean
                mean += delta / n
                delta2 = check.measure - mean
                s += delta * delta2

            if n > 1:
                point.average = mean
                point.standard_deviation = sqrt( s / ( n - 1))
            elif n == 1:
                point.average = mean
                point.standard_deviation = 0.0
            else:
                point.average = 0.0
                point.standard_deviation = 0.0

    @api.onchange('norm')
    def onchange_norm(self):
        if self.tolerance_max == 0.0:
            self.tolerance_max = self.norm

    def check_execute_now(self):
        self.ensure_one()
        if self.measure_frequency_type == 'all':
            return True
        elif self.measure_frequency_type == 'random':
            return (random.random() < self.measure_frequency_value / 100.0)
        elif self.measure_frequency_type == 'periodical':
            delta = False
            if self.measure_frequency_unit == 'day':
                delta = relativedelta(days=self.measure_frequency_unit_value)
            elif self.measure_frequency_unit == 'week':
                delta = relativedelta(weeks=self.measure_frequency_unit_value)
            elif self.measure_frequency_unit == 'month':
                delta = relativedelta(months=self.measure_frequency_unit_value)
            date_previous = datetime.today() - delta
            checks = self.env['quality.check'].search([
                ('point_id', '=', self.id),
                ('create_date', '>=', date_previous.strftime(DEFAULT_SERVER_DATETIME_FORMAT))], limit=1)
            return not(bool(checks))
        return super(QualityPoint, self).check_execute_now()

    def _get_type_default_domain(self):
        domain = super(QualityPoint, self)._get_type_default_domain()
        domain.append(('technical_name', '=', 'passfail'))
        return domain

    def action_see_quality_checks(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_check_action_main")
        action['domain'] = [('point_id', '=', self.id)]
        action['context'] = {
            'default_company_id': self.company_id.id,
            'default_point_id': self.id
        }
        return action

    def action_see_spc_control(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_check_action_spc")
        if self.test_type == 'measure':
            action['context'] = {'group_by': ['name', 'point_id'], 'graph_measure': ['measure'], 'graph_mode': 'line'}
        action['domain'] = [('point_id', '=', self.id), ('quality_state', '!=', 'none')]
        return action


class QualityCheck(models.Model):
    _inherit = "quality.check"

    failure_message = fields.Html(related='point_id.failure_message', readonly=True)
    measure = fields.Float('Measure', default=0.0, digits='Quality Tests', tracking=True)
    measure_success = fields.Selection([
        ('none', 'No measure'),
        ('pass', 'Pass'),
        ('fail', 'Fail')], string="Measure Success", compute="_compute_measure_success",
        readonly=True, store=True)
    tolerance_min = fields.Float('Min Tolerance', related='point_id.tolerance_min', readonly=True)
    tolerance_max = fields.Float('Max Tolerance', related='point_id.tolerance_max', readonly=True)
    warning_message = fields.Text(compute='_compute_warning_message')
    norm_unit = fields.Char(related='point_id.norm_unit', readonly=True)

    @api.depends('measure_success')
    def _compute_warning_message(self):
        for rec in self:
            if rec.measure_success == 'fail':
                rec.warning_message = _('You measured %.2f %s and it should be between %.2f and %.2f %s.') % (
                    rec.measure, rec.norm_unit, rec.point_id.tolerance_min,
                    rec.point_id.tolerance_max, rec.norm_unit
                )
            else:
                rec.warning_message = ''

    @api.depends('measure')
    def _compute_measure_success(self):
        for rec in self:
            if rec.point_id.test_type == 'passfail':
                rec.measure_success = 'none'
            else:
                if rec.measure < rec.point_id.tolerance_min or rec.measure > rec.point_id.tolerance_max:
                    rec.measure_success = 'fail'
                else:
                    rec.measure_success = 'pass'

    # Add picture dependency
    @api.depends('picture')
    def _compute_result(self):
        super(QualityCheck, self)._compute_result()

    def _get_check_result(self):
        if self.test_type == 'picture' and self.picture:
            return _('Picture Uploaded')
        else:
            return super(QualityCheck, self)._get_check_result()

    def do_measure(self):
        self.ensure_one()
        if self.measure < self.point_id.tolerance_min or self.measure > self.point_id.tolerance_max:
            return self.do_fail()
        else:
            return self.do_pass()

    def correct_measure(self):
        self.ensure_one()
        return {
            'name': _('Quality Checks'),
            'type': 'ir.actions.act_window',
            'res_model': 'quality.check',
            'view_mode': 'form',
            'view_id': self.env.ref('quality_control.quality_check_view_form_small').id,
            'target': 'new',
            'res_id': self.id,
            'context': self.env.context,
        }

    def do_alert(self):
        self.ensure_one()
        alert = self.env['quality.alert'].create({
            'check_id': self.id,
            'product_id': self.product_id.id,
            'product_tmpl_id': self.product_id.product_tmpl_id.id,
            'lot_id': self.lot_id.id,
            'user_id': self.user_id.id,
            'team_id': self.team_id.id,
            'company_id': self.company_id.id
        })
        return {
            'name': _('Quality Alert'),
            'type': 'ir.actions.act_window',
            'res_model': 'quality.alert',
            'views': [(self.env.ref('quality_control.quality_alert_view_form').id, 'form')],
            'res_id': alert.id,
            'context': {'default_check_id': self.id},
        }

    def action_see_alerts(self):
        self.ensure_one()
        if len(self.alert_ids) == 1:
            return {
                'name': _('Quality Alert'),
                'type': 'ir.actions.act_window',
                'res_model': 'quality.alert',
                'views': [(self.env.ref('quality_control.quality_alert_view_form').id, 'form')],
                'res_id': self.alert_ids.ids[0],
                'context': {'default_check_id': self.id},
            }
        else:
            action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_alert_action_check")
            action['domain'] = [('id', 'in', self.alert_ids.ids)]
            action['context'] = dict(self._context, default_check_id=self.id)
            return action

    def redirect_after_pass_fail(self):
        check = self[0]
        if check.quality_state == 'fail' and check.test_type in ['passfail', 'measure'] and (check.failure_message or check.warning_message):
            return self.show_failure_message()
        if check.picking_id:
            checkable_products = check.picking_id.mapped('move_line_ids').mapped('product_id')
            checks = self.picking_id.check_ids.filtered(lambda x: x.quality_state == 'none' and x.product_id in checkable_products)
            if checks:
                action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_check_action_small")
                action['res_id'] = checks.ids[0]
                return action
            if self.env.context.get('pickings_to_check_quality'):  # handle pre_done_hook + multi cases
                pickings_to_check_quality = check.picking_id.browse(self.env.context['pickings_to_check_quality'])
                remaining_pickings_to_check_quality = pickings_to_check_quality._check_for_quality_checks()
                if remaining_pickings_to_check_quality:
                    return remaining_pickings_to_check_quality[0].check_quality()
                else:
                    pickings_to_check_quality.button_validate()
        return super(QualityCheck, self).redirect_after_pass_fail()

    def redirect_after_failure(self):
        check = self[0]
        if check.picking_id:
            checkable_products = check.picking_id.mapped('move_line_ids').mapped('product_id')
            checks = self.picking_id.check_ids.filtered(lambda x: x.quality_state == 'none' and x.product_id in checkable_products)
            if checks:
                action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_check_action_small")
                action['res_id'] = checks.ids[0]
                return action
            if self.env.context.get('pickings_to_check_quality'):  # handle pre_done_hook + multi cases
                pickings_to_check_quality = check.picking_id.browse(self.env.context['pickings_to_check_quality'])
                remaining_pickings_to_check_quality = pickings_to_check_quality._check_for_quality_checks()
                if remaining_pickings_to_check_quality:
                    return remaining_pickings_to_check_quality[0].check_quality()
                else:
                    pickings_to_check_quality.button_validate()
        return super(QualityCheck, self).redirect_after_pass_fail()

    def show_failure_message(self):
        return {
            'name': _('Quality Check Failed'),
            'type': 'ir.actions.act_window',
            'res_model': 'quality.check',
            'view_mode': 'form',
            'view_id': self.env.ref('quality_control.quality_check_view_form_failure').id,
            'target': 'new',
            'res_id': self.id,
            'context': self.env.context,
        }
class QualityAlert(models.Model):
    _inherit = "quality.alert"

    title = fields.Char('Title')

    def action_see_check(self):
        return {
            'name': _('Quality Check'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'quality.check',
            'target': 'current',
            'res_id': self.check_id.id,
        }

    @api.depends('name', 'title')
    def name_get(self):
        result = []
        for record in self:
            name = record.name + ' - ' + record.title if record.title else record.name
            result.append((record.id, name))
        return result

    @api.model
    def name_create(self, name):
        """ Create an alert with name_create should use prepend the sequence in the name """
        values = {
            'title': name,
        }
        return self.create(values).name_get()[0]

    @api.model
    def message_new(self, msg_dict, custom_values=None):
        """ Override, used with creation by email alias. The purpose of the override is
        to use the subject for title and body for description instead of the name.
        """
        # We need to add the name in custom_values or it will use the subject.
        custom_values['name'] = self.env['ir.sequence'].next_by_code('quality.alert') or _('New')
        if msg_dict.get('subject'):
            custom_values['title'] = msg_dict['subject']
        if msg_dict.get('body'):
            custom_values['description'] = msg_dict['body']
        return super(QualityAlert, self).message_new(msg_dict, custom_values)


class ProductTemplate(models.Model):
    _inherit = "product.template"

    quality_control_point_qty = fields.Integer(compute='_compute_quality_check_qty', groups='quality.group_quality_user')
    quality_pass_qty = fields.Integer(compute='_compute_quality_check_qty', groups='quality.group_quality_user')
    quality_fail_qty = fields.Integer(compute='_compute_quality_check_qty', groups='quality.group_quality_user')

    @api.depends('product_variant_ids')
    def _compute_quality_check_qty(self):
        self.quality_fail_qty = 0
        self.quality_pass_qty = 0
        self.quality_control_point_qty = 0

        for product_tmpl in self:
            quality_checks_by_state = self.env['quality.check'].read_group(
                [('product_id', 'in', product_tmpl.product_variant_ids.ids), ('company_id', '=', self.env.company.id)],
                ['product_id'],
                ['quality_state']
            )
            for checks_data in quality_checks_by_state:
                if checks_data['quality_state'] == 'fail':
                    product_tmpl.quality_fail_qty = checks_data['quality_state_count']
                elif checks_data['quality_state'] == 'pass':
                    product_tmpl.quality_pass_qty = checks_data['quality_state_count']
            query = self.env['quality.point']._where_calc([('company_id', '=', self.env.company.id)])
            self.env['quality.point']._apply_ir_rules(query, 'read')
            _, where_clause, where_clause_args = query.get_sql()
            self.env.cr.execute(
            """
                SELECT COUNT(*)
                    FROM quality_point
                    WHERE %s
                    AND (
                        EXISTS (SELECT 1 FROM product_product_quality_point_rel rel WHERE rel.quality_point_id = quality_point.id AND rel.product_product_id = ANY(%%s))
                        OR
                        NOT EXISTS (SELECT 1 FROM product_product_quality_point_rel rel WHERE rel.quality_point_id = quality_point.id)
                        )
            """ % (where_clause,), where_clause_args + [list(product_tmpl.product_variant_ids.ids)]
            )
            product_tmpl.quality_control_point_qty = self.env.cr.fetchone()[0]

    def action_see_quality_control_points(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_point_action")
        action['context'] = dict(self.env.context, default_product_ids=self.product_variant_ids.ids)
        action['domain'] = [
            '|', ('product_ids', '=', False), ('product_ids', 'in', self.product_variant_ids.ids)
        ]
        return action

    def action_see_quality_checks(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_check_action_main")
        action['context'] = dict(self.env.context, default_product_id=self.product_variant_id.id, create=False)
        action['domain'] = [('product_id', 'in', self.product_variant_ids.ids)]
        return action


class ProductProduct(models.Model):
    _inherit = "product.product"

    quality_control_point_qty = fields.Integer(compute='_compute_quality_check_qty', groups='quality.group_quality_user')
    quality_pass_qty = fields.Integer(compute='_compute_quality_check_qty', groups='quality.group_quality_user')
    quality_fail_qty = fields.Integer(compute='_compute_quality_check_qty', groups='quality.group_quality_user')

    def _compute_quality_check_qty(self):
        self.quality_fail_qty = 0
        self.quality_pass_qty = 0
        self.quality_control_point_qty = 0
        for product in self:
            quality_checks_by_state = self.env['quality.check'].read_group(
                [('product_id', '=', product.id), ('company_id', '=', self.env.company.id)],
                ['product_id'],
                ['quality_state']
            )
            for checks_data in quality_checks_by_state:
                if checks_data['quality_state'] == 'fail':
                    product.quality_fail_qty = checks_data['quality_state_count']
                elif checks_data['quality_state'] == 'pass':
                    product.quality_pass_qty = checks_data['quality_state_count']
            query = self.env['quality.point']._where_calc([('company_id', '=', self.env.company.id)])
            self.env['quality.point']._apply_ir_rules(query, 'read')
            _, where_clause, where_clause_args = query.get_sql()
            self.env.cr.execute(
            """
                SELECT COUNT(*)
                    FROM quality_point
                    WHERE %s
                    AND (
                        EXISTS (SELECT 1 FROM product_product_quality_point_rel rel WHERE rel.quality_point_id = quality_point.id AND rel.product_product_id = %%s)
                        OR
                        NOT EXISTS (SELECT 1 FROM product_product_quality_point_rel rel WHERE rel.quality_point_id = quality_point.id)
                        )
            """ % (where_clause,), where_clause_args + [product.id]
            )
            product.quality_control_point_qty = self.env.cr.fetchone()[0]


    def action_see_quality_control_points(self):
        self.ensure_one()
        action = self.product_tmpl_id.action_see_quality_control_points()
        action['context'].update(default_product_ids=self.ids)
        action['domain'] = [
            '|', ('product_ids', '=', False), ('product_ids', 'in', self.ids)
        ]
        return action

    def action_see_quality_checks(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("quality_control.quality_check_action_main")
        action['context'] = dict(self.env.context, default_product_id=self.id, create=False)
        action['domain'] = [('product_id', '=', self.id)]
        return action
