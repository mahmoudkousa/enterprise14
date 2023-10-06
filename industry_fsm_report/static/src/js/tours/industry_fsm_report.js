odoo.define("industry_fsm_report.tour", function (require) {
"use strict";
/**
 * Add custom steps to take worksheets into account
 */
var tour = require('web_tour.tour');
    require('industry_fsm.tour');
var core = require('web.core');
var _t = core._t;

var fsmStartStepIndex = _.findIndex(tour.tours.industry_fsm_tour.steps, function (step) {
    return (step.id === 'fsm_start');
});

tour.tours.industry_fsm_tour.steps.splice(fsmStartStepIndex + 1, 0, {
    trigger: 'button[name="action_fsm_worksheet"]',
    extra_trigger: 'button[name="action_timer_stop"]',
    content: _t('Fill in your worksheet with the details of your intervention.'),
    position: 'bottom',
}, {
    trigger: ".o_form_button_save",
    content: _t('Save your worksheet once it is complete.<br/><i>Note that this form can be entirely customized to fit your specific needs.<br/>You will also be able to create multiple worksheet templates for each kind of intervention you may have.</i>'),
    extra_trigger: '.o_fsm_worksheet_form',
    position: 'bottom'
}, {
    trigger: ".breadcrumb-item:not(.active):last",
    extra_trigger: '.o_fsm_worksheet_form',
    content: _t("Use the breadcrumbs to <b>go back to your task</b>."),
    position: "right"

});

var fsmSaveTimesheetStepIndex = _.findIndex(tour.tours.industry_fsm_tour.steps, function (step) {
    return (step.id === 'fsm_save_timesheet');
});

tour.tours.industry_fsm_tour.steps.splice(fsmSaveTimesheetStepIndex + 1, 0, {
    trigger: 'button[name="action_preview_worksheet"]',
    extra_trigger: '.o_form_project_tasks',
    content: _t('Review the worksheet report with your customer and ask him to sign it.'),
    position: 'bottom',
}, {
    trigger: 'a[data-target="#modalaccept"]',
    extra_trigger: 'div[id="o_fsm_worksheet_portal"]',
    content: _t('Invite your customer to validate and to sign your worksheet report.'),
    position: 'right',
}, {
    trigger: '.o_web_sign_auto_button',
    extra_trigger: 'div[id="o_fsm_worksheet_portal"]',
    content: _t('Generate a signature automatically or write it by hand.'),
    position: 'right',
}, {
    trigger: '.o_portal_sign_submit:enabled',
    extra_trigger: 'div[id="o_fsm_worksheet_portal"]',
    content: _t('Validate the signature.'),
    position: 'left',
}, {
    trigger: 'a:contains(Back to edit mode)',
    extra_trigger: 'div[id="o_fsm_worksheet_portal"]',
    content: _t('Go back to your Field Service task.'),
    position: 'right',
}, {
    trigger: 'button[name="action_send_report"]',
    extra_trigger: '.o_form_project_tasks ',
    content: _t('Send the report of your intervention to your customer.'),
    position: 'bottom',
}, {
    trigger: 'button[name="action_send_mail"]',
    extra_trigger: '.o_form_project_tasks ',
    content: _t('Send the report of your intervention to your customer.'),
    position: 'bottom',
});

});
