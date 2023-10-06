# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
from odoo.http import request
from odoo.exceptions import ValidationError


class AccountChartTemplate(models.Model):
    _inherit = "account.chart.template"

    def _configure_additional_structures(self, accounts, journal):
        super()._configure_additional_structures(accounts, journal)

        # ================================================ #
        #              CP200: Commissions                  #
        # ================================================ #
        structure = self.env.ref('l10n_be_hr_payroll_variable_revenue.hr_payroll_structure_cp200_structure_commission')
        self.env['ir.property']._set_multi(
            "journal_id",
            "hr.payroll.structure",
            {structure.id: journal},
        )

        # Remunerations
        self.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_commission_commissions').write({
            'account_debit': accounts['620200'].id
        })

        # ONSS (Onss - employment bonus)
        self.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_commission_onss_total').write({
            'account_credit': accounts['454000'].id,
        })

        # Total withholding taxes
        self.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_commission_pp_total').write({
            'account_credit': accounts['453000'].id,
        })

        # Special Social Cotisation (MISC ONSS)
        self.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_commission_mis_ex_onss_total').write({
            'account_credit': accounts['454000'].id,
        })

        # Owed Remunerations (NET)
        self.env['hr.salary.rule'].search([
            ('struct_id', '=', self.env.ref('l10n_be_hr_payroll_variable_revenue.hr_payroll_structure_cp200_structure_commission').id),
            ('code', '=', 'NET')
        ]).write({
            'account_credit': accounts['455000'].id
        })

        # ONSS Employer
        self.env.ref('l10n_be_hr_payroll_variable_revenue.cp200_commission_salary_onss_employer').write({
            'account_debit': accounts['621000'].id,
            'account_credit': accounts['454000'].id,
        })
