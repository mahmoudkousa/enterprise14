# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Mod303Wizard(models.TransientModel):
    _inherit = 'l10n_es_reports.mod303.wizard'

    casilla_77 = fields.Monetary(string="[77] IVA a la importación liquidado por la Aduana pendiente de ingreso", default=0)
