# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, api, _

from datetime import datetime
from collections import defaultdict


class IntrastatExpiryReport(models.AbstractModel):
    _inherit = 'account.intrastat.report'

    @api.model
    def _build_query(self, date_from, date_to, journal_ids, invoice_types=None, with_vat=False):
        query, params = super()._build_query(date_from, date_to, journal_ids, invoice_types, with_vat)
        query['select'] = """
            transaction.expiry_date <= invoice_date AS expired_trans,
            transaction.start_date > invoice_date AS premature_trans,
            code.expiry_date <= invoice_date AS expired_comm,
            code.start_date > invoice_date AS premature_comm,
            prod.id AS product_id,
			prodt.categ_id AS template_categ,
        """ + query['select']
        return query, params

    @api.model
    def _create_intrastat_report_line(self, options, vals):
        for error, val_key in (
            ('expired_trans', 'invoice_id'),
            ('premature_trans', 'invoice_id'),
            ('expired_comm', 'product_id'),
            ('premature_comm', 'product_id'),
            ('expired_templ_comm', 'template_categ'),
            ('premature_templ_comm', 'template_categ'),
        ):
            if vals.get(error):
                options['warnings'][error].add(vals[val_key])

        return super()._create_intrastat_report_line(options, vals)

    @api.model
    def _get_lines(self, options, line_id=None):
        options['warnings'] = defaultdict(set)
        res = super()._get_lines(options, line_id)
        options['warnings'] = {k: list(v) for k, v in options['warnings'].items()}
        return res

    def action_invalid_code_moves(self, options, params):
        return {
            'type': 'ir.actions.act_window',
            'name': _('Invalid transaction intrastat code entries.'),
            'res_model': 'account.move',
            'views': [(False, 'tree'), (False, 'form')],
            'domain': [('id', 'in', options['warnings'][params['option_key']])],
            'context': {'create': False, 'delete': False},
        }

    def action_invalid_code_products(self, options, params):
        return {
            'type': 'ir.actions.act_window',
            'name': _('Invalid commodity intrastat code products.'),
            'res_model': 'product.product',
            'views': [(
                self.env.ref('account_intrastat_expiry.product_product_tree_view_account_intrastat_expiry').id,
                'list',
            ), (False, 'form')],
            'domain': [('id', 'in', options['warnings'][params['option_key']])],
            'context': {
                'create': False,
                'delete': False,
                'search_default_group_by_intrastat_id': True,
                'expand': True,
            },
        }

    def action_invalid_code_product_categories(self, options, params):
        return {
            'type': 'ir.actions.act_window',
            'name': _('Invalid commodity intrastat code product categories.'),
            'res_model': 'product.category',
            'views': [(
                self.env.ref('account_intrastat_expiry.product_category_tree_view_account_intrastat_expiry').id,
                # False,
                'list',
            ), (False, 'form')],
            'domain': [('id', 'in', options['warnings'][params['option_key']])],
            'context': {
                'create': False,
                'delete': False,
                'search_default_group_by_intrastat_id': True,
                'expand': True,
            },
        }

    @api.model
    def _fill_missing_values(self, vals, cache=None):
        if cache is None:
            cache = {}

        for val in vals:
            # set transaction_code default value if none, code "1" is expired from 2022-01-01, replaced by code "11"
            if not val['transaction_code']:
                val['transaction_code'] = 1 if val['invoice_date'] < datetime.strptime('2022-01-01', '%Y-%m-%d').date() else 11

        res = super()._fill_missing_values(vals, cache)

        for val in vals:
            commodity_code_code = cache.get('commodity_code_%d' % val['template_id'])
            if commodity_code_code:
                commodity_code = cache.get('commodity_code_obj_%s' % commodity_code_code)
                if not commodity_code:
                    commodity_code = self.env['account.intrastat.code'].search([('code', '=', commodity_code_code)], limit=1)
                    cache['commodity_code_obj_%s' % commodity_code_code] = commodity_code
                if commodity_code.expiry_date and commodity_code.expiry_date <= val['invoice_date']:
                    val['expired_templ_comm'] = True
                if commodity_code.start_date and commodity_code.start_date > val['invoice_date']:
                    val['premature_templ_comm'] = True

        return res
