odoo.define('planning.PlanningGanttView', function (require) {
    'use strict';

    const HrGanttView = require('hr_gantt.GanttView');
    const PlanningGanttController = require('planning.PlanningGanttController');
    const PlanningGanttModel = require('planning.PlanningGanttModel');
    const PlanningGanttRenderer = require('planning.PlanningGanttRenderer');

    const view_registry = require('web.view_registry');

    const PlanningGanttView = HrGanttView.extend({
        config: Object.assign({}, HrGanttView.prototype.config, {
            Renderer: PlanningGanttRenderer,
            Controller: PlanningGanttController,
            Model: PlanningGanttModel,
        }),
    });

    view_registry.add('planning_gantt', PlanningGanttView);

    return PlanningGanttView;

});
