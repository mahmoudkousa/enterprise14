odoo.define('planning.PlanningGanttRow', function (require) {
    'use strict';
    const HrGanttRow = require('hr_gantt.GanttRow');

    const PlanningGanttRow = HrGanttRow.extend({
        template: 'PlanningGanttView.Row'
    });

    return PlanningGanttRow;
});
