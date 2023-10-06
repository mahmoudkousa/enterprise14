odoo.define('forecast_timesheet.ForecastTimesheetGanttView', function (require) {
    'use strict';

    const viewRegistry = require('web.view_registry');
    const ForecastGanttView = require('forecast.ForecastGanttView');
    const PlanningGanttRenderer = require('planning.PlanningGanttRenderer');
    const PlanningGanttRow = require('planning.PlanningGanttRow');

    const ForecastTimesheetGanttRow = PlanningGanttRow.extend({
        template: 'PlanningTimesheetGanttView.Row',

        /**
         * @override
         */
        init(parent, pillsInfo, viewInfo, options) {
            this._super(...arguments);
            // here find slots with pills and task_id
            if (this.pills) {
                // there are slots.
                this.pills.forEach((pill) => {
                    if (pill.task_id && pill.allocated_hours) {
                        // the slot have a task_id, we need to display the cell as a progress bar
                        pill.progress = Math.round(pill.effective_hours / pill.allocated_hours * 100);
                    } else {
                        pill.progress = 0;
                    }
                });
            }
        },
    });

    const ForecastTimesheetGanttRenderer = PlanningGanttRenderer.extend({
        config: Object.assign({}, PlanningGanttRenderer.prototype.config, {
            GanttRow: ForecastTimesheetGanttRow,
        }),
    });

    const ForecastTimesheetGanttView = ForecastGanttView.extend({
        config: Object.assign({}, ForecastGanttView.prototype.config, {
            Renderer: ForecastTimesheetGanttRenderer,
        }),
    });

    viewRegistry.add('forecast_timesheet', ForecastTimesheetGanttView);
    return ForecastTimesheetGanttView;
});
