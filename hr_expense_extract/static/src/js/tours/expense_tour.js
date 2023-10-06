odoo.define('hr_expense_extract.tour', function(require) {
"use strict";

var core = require('web.core');
var tour = require('web_tour.tour');

var _t = core._t;

tour.register('hr_expense_extract_tour' , {
    url: "/web",
    rainbowMan: true,
    rainbowManMessage: "<b>Congratulations</b>, you are now an expert of Expenses.",
    sequence: 42,
}, [tour.stepUtils.showAppsMenuItem(), {
    trigger: '.o_app[data-menu-xmlid="hr_expense.menu_hr_expense_root"]',
    content: _t("Wasting time recording your receipts? Let’s try a better way."),
    position: 'bottom',
}, {
    trigger: '.o_nocontent_help a.btn-primary',
    content: _t("Try the AI with a sample receipt."),
    position: 'bottom',
}, {
    trigger: "button[name='action_choose_sample_2']",
    content: _t("Choose a receipt."),
    position: 'right',
}, {
    trigger: "button[name='action_submit_expenses']",
    content: _t("Report this expense to your manager for validation."),
    position: 'bottom',
}, {
    trigger: "button[name='approve_expense_sheets']",
    content: _t("Your manager will have to approve or refuse the expense report."),
    position: 'bottom',
}, {
    trigger: "button[name='action_sheet_move_create']",
    content: _t("Once approved, the accountant will post the journal entries in their accounting."),
    position: 'bottom',
}, {
    trigger: "button.o_expense_sheet_pay",
    content: _t("Once the accountant approves, he will reimburse you."),
    position: 'bottom',
}, {
    trigger: "div.modal-dialog select[name='journal_id']",
    content: _t("Select a payment method."),
    position: 'bottom',
}, {
    trigger: "button[name='expense_post_payment']",
    extra_trigger: "div.modal-dialog div[name='partner_bank_account_id']",
    content: _t("Now, register the payment."),
    position: 'bottom',
}]);

});
