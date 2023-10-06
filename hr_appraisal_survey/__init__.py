# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, SUPERUSER_ID, _

from . import models
from . import wizard
from . import controllers

def _setup_survey_template(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    default_template = env['res.company']._get_default_appraisal_survey_template_id()
    env['res.company'].search([]).write({
        'appraisal_survey_template_id': default_template.id,
    })

def uninstall_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    xml_ids = [
        'survey.survey_user_input_rule_survey_manager',
        'survey.survey_user_input_rule_survey_user_read',
        'survey.survey_user_input_rule_survey_user_cw',
        'survey.survey_user_input_line_rule_survey_manager',
        'survey.survey_user_input_line_rule_survey_user_read',
        'survey.survey_user_input_line_rule_survey_user_cw'
    ]
    domain = "('survey_id.is_appraisal', '=', False)"
    for xml_id in xml_ids:
        rule = env.ref(xml_id, raise_if_not_found=False)
        if rule:
            rule.domain_force = rule.domain_force.replace(domain, "(1, '=', 1)")
