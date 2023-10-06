# -*- coding: utf-8 -*-

from odoo import models

class generic_tax_report(models.AbstractModel):
    _inherit = 'account.generic.tax.report'

    def _get_templates(self):
        # Overridden to add an option to the tax report to display it grouped by tax grid.
        rslt = super(generic_tax_report, self)._get_templates()
        rslt['main_template'] = 'account_reports_tax.template_tax_report'
        return rslt
