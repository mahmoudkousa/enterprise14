odoo.define('hr_payroll.payslip.run.tree', function (require) {
"use strict";
    var core = require('web.core');
    var ListController = require('web.ListController');
    var ListView = require('web.ListView');
    var viewRegistry = require('web.view_registry');

    var QWeb = core.qweb;

    var PayslipBatchListController = ListController.extend({
        /**
         * Extends the renderButtons function of ListView by adding a button
         * on the payslip batch list.
         *
         * @override
         */
        renderButtons: function () {
            var self = this;
            this._super.apply(this, arguments);
            this.$buttons.append($(QWeb.render("PayslipBatchListView.generate_commission_payslips", this)));
            this.$buttons.on('click', '.o_button_generate_commission_payslips', function () {
                self.do_action('l10n_be_hr_payroll_variable_revenue.action_hr_payroll_generate_commission_payslips');
            });
        }
    });

    var PayslipBatchListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: PayslipBatchListController,
        }),
    });

    viewRegistry.add('hr_payslip_run_tree', PayslipBatchListView);
});
