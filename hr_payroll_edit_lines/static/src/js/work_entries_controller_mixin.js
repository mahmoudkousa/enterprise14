odoo.define('hr_payroll_edit_lines.WorkEntryControllerMixin', function(require) {
    'use strict';

    var core = require('web.core');
    var _t = core._t;
    var QWeb = core.qweb;
    var time = require('web.time');

    var WorkEntryCalendarController = require('hr_work_entry_contract.work_entries_calendar');
    var WorkEntryGanttController = require('hr_work_entry_contract.work_entries_gantt');

    var WorkEntryControllerMixin = {
        /**
         * @override
         * @returns {Promise}
         */
        _update: function () {
            var self = this;
            var res = this._super.apply(this, arguments);
            self._renderRegenerateWorkEntryButton();
            return res;
        },

        _renderRegenerateWorkEntryButton: function () {
            if (this.modelName !== "hr.work.entry") {
                return;
            }
            this.$buttons.append(QWeb.render('hr_work_entry.work_entry_button', {
                button_text: _t("Regenerate Work Entries"),
                event_class: 'btn-regenerate-work-entries',
            }));
            this.$buttons.find('.btn-regenerate-work-entries').on('click', this._onRegenerateWorkEntries.bind(this));
        },

        _regenerateWorkEntries: function () {
            this.do_action('hr_payroll_edit_lines.hr_work_entry_regeneration_wizard_action', {
                additional_context: {
                    date_start: time.date_to_str(this.firstDay),
                    date_end: time.date_to_str(this.lastDay),
                },
            });
        },

        _onRegenerateWorkEntries: function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._regenerateWorkEntries();
        },

    };

    WorkEntryCalendarController.include(WorkEntryControllerMixin);
    WorkEntryGanttController.include(WorkEntryControllerMixin);
});
