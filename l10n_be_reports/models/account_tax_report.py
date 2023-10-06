# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models


class AccountTaxReport(models.Model):
    _inherit = 'account.tax.report'

    # https://eservices.minfin.fgov.be/intervat/static/help/FR/regles_de_validation_d_une_declaration.htm
    # The numerotation in the comments is extended here if it wasn't done in the
    # source document: ... X, Y, Z, AA, AB, AC, ...
    def get_checks_to_perform(self, d):
        if self.id == self.env['ir.model.data'].xmlid_to_res_id('l10n_be.tax_report_vat'):
            return [
                # code 13
                (_('No negative number'),
                    not all(v >= 0 for v in d.values())),
                # Code C
                (_('[55] > 0 if [86] > 0 or [88] > 0'),
                    min(0.0, d['c55']) if d['c86'] > 0 or d['c88'] > 0 else False),
                # Code D
                (_('[56] + [57] > 0 if [87] > 0'),
                    min(0.0, d['c55']) if d['c86'] > 0 or d['c88'] > 0 else False),
                # Code O
                ('[01] * 6% + [02] * 12% + [03] * 21% = [54]',
                    d['c01'] * 0.06 + d['c02'] * 0.12 + d['c03'] * 0.21 - d['c54'] if abs(d['c01'] * 0.06 + d['c02'] * 0.12 + d['c03'] * 0.21 - d['c54']) > 62 else False),
                # Code P
                ('([84] + [86] + [88]) * 21% >= [55]',
                    min(0.0, (d['c84'] + d['c86'] + d['c88']) * 0.21 - d['c55']) if min(0.0, (d['c84'] + d['c86'] + d['c88']) * 0.21 - d['c55']) < -62 else False),
                # Code Q
                ('([85] + [87]) * 21% >= ([56] + [57])',
                    min(0.0, (d['c85'] + d['c87']) * 0.21 - (d['c56'] + d['c57'])) if min(0.0, (d['c85'] + d['c87']) * 0.21 - (d['c56'] + d['c57'])) < -62 else False),
                # Code S
                ('([81] + [82] + [83] + [84] + [85]) * 50% >= [59]',
                    min(0.0, (d['c81'] + d['c82'] + d['c83'] + d['c84'] + d['c85']) * 0.5 - d['c59'])),
                # Code T
                ('[85] * 21% >= [63]',
                    min(0.0, d['c85'] * 0.21 - d['c63']) if min(0.0, d['c85'] * 0.21 - d['c63']) < -62 else False),
                # Code U
                ('[49] * 21% >= [64]',
                    min(0.0, d['c49'] * 0.21 - d['c64']) if min(0.0, d['c49'] * 0.21 - d['c64']) < -62 else False),
                # Code AC
                (_('[88] < ([81] + [82] + [83] + [84]) * 100 if [88] > 99.999'),
                    max(0.0, d['c88'] - (d['c81'] + d['c82'] + d['c83'] + d['c84']) * 100) if d['c88'] > 99999 else False),
                # Code AD
                (_('[44] < ([00] + [01] + [02] + [03] + [45] + [46] + [47] + [48] + [49]) * 200 if [44] > 99.999'),
                    max(0.0, d['c44'] - (d['c00'] + d['c01'] + d['c02'] + d['c03'] + d['c45'] + d['c46'] + d['c47'] + d['c48'] + d['c49']) * 200) if d['c44'] > 99999 else False),
            ]
        return super(AccountTaxReport, self).get_checks_to_perform(d)
