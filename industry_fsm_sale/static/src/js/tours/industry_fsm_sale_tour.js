odoo.define("sale_industry_fsm.tour", function (require) {
"use strict";
/**
 * Add custom steps to take products and sales order into account
 */
var tour = require('web_tour.tour');
require('industry_fsm.tour');
var core = require('web.core');
var _t = core._t;

var fsmStartStepIndex = _.findIndex(tour.tours.industry_fsm_tour.steps, function (step) {
    return (step.id === 'fsm_start');
});

tour.tours.industry_fsm_tour.steps.splice(fsmStartStepIndex + 1, 0, {
    trigger: 'button[name="action_fsm_view_material"]',
    extra_trigger: 'button[name="action_timer_stop"]',
    content: _t('Record the material you used for the intervention.'),
    position: 'bottom',
}, {
    trigger: ".o-kanban-button-new",
    content: _t('Create a new product.'),
    position: 'right',
}, {
    trigger: 'input.o_field_char',
    content: _t('Choose a name for your product <i>(e.g. Bolts, Screws, Boiler...).</i>'),
    position: 'right',
}, {
    trigger: ".o_form_button_save",
    content: _t("Save your product."),
    position: "bottom",
}, {
    trigger: ".breadcrumb-item:not(.active):last",
    extra_trigger: ".btn-primary",
    content: _t("Use the breadcrumbs to <b>go back to your products list</b>."),
    position: "right",
}, {
    trigger: ".oe_kanban_action:contains('+')",
    extra_trigger: '.o_fsm_material_kanban',
    content: _t('Add a product by clicking on it.'),
    position: 'right',
}, {
    trigger: ".breadcrumb-item:not(.active):last",
    extra_trigger: '.o_fsm_material_kanban',
    content: _t("Use the breadcrumbs to <b>go back to your task</b>."),
    position: "right"
});

var fsmCreateInvoiceStepIndex = _.findIndex(tour.tours.industry_fsm_tour.steps, function (step) {
    return (step.id === 'fsm_invoice_create');
});

tour.tours.industry_fsm_tour.steps.splice(fsmCreateInvoiceStepIndex + 1, 0, {
    trigger: ".o_statusbar_buttons > button:contains('Create Invoice')",
    content: _t("Invoice your time and material to your customer."),
    position: "bottom"
}, {
    trigger: ".modal-footer button[id='create_invoice_open'].btn-primary",
    extra_trigger: ".modal-dialog.modal-lg",
    content: _t("Invoice your time and material to your customer or ask for a down payment first."),
    position: "bottom"
});

});
