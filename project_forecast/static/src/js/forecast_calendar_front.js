odoo.define('project_forecast.calendar_frontend', function (require) {
"use strict";

const PlanningView = require('planning.calendar_frontend');

PlanningView.include({
        // override popup of calendar
        eventFunction: function (calEvent) {
            this._super.apply(this, arguments);
            if (calEvent.event.extendedProps.project) {
                $("#project").text(calEvent.event.extendedProps.project);
                $("#project").css("display", "");
                $("#project").prev().css("display", "");
            } else {
                $("#project").css("display", "none");
                $("#project").prev().css("display", "none");
            }
            if (calEvent.event.extendedProps.task) {
                $("#task").text(calEvent.event.extendedProps.task);
                $("#task").prev().css("display", "");
                $("#task").css("display", "");
            } else {
                $("#task").css("display", "none");
                $("#task").prev().css("display", "none");
            }
        },
    });
});
