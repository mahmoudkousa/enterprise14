# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class SurveySurvey(models.Model):
    _inherit = 'survey.survey'

    is_appraisal = fields.Boolean(
        string="Appraisal Managers Only",
        help="Check this option to restrict the answers to appraisal managers only.")


class SurveyUserInput(models.Model):
    _inherit = 'survey.user_input'

    appraisal_id = fields.Many2one('hr.appraisal')
