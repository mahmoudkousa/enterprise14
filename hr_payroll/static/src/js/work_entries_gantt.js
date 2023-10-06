odoo.define('hr_payroll.work_entries_gantt', function (require) {
    'use strict';

    var WorkEntryPayrollControllerMixin = require('hr_payroll.WorkEntryPayrollControllerMixin');
    var WorkEntryGanttController = require("hr_work_entry_contract.work_entries_gantt");

    var WorkEntryPayrollCalendarController = WorkEntryGanttController.include(WorkEntryPayrollControllerMixin);

    return WorkEntryPayrollCalendarController;

});

