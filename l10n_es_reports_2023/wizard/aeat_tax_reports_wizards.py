# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Mod303Wizard(models.TransientModel):
    _inherit = 'l10n_es_reports.mod303.wizard'

    casilla_109 = fields.Monetary(string='[109] Devoluciones acordadas por la Agencia Tributaria como consecuencia de la tramitación de anteriores autoliquidaciones correspondientes al ejercicio y período objeto de la autoliquidación', default=0)
