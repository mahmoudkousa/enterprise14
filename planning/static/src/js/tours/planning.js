odoo.define('planning.tour', function (require) {
    "use strict";

    var core = require('web.core');
    var tour = require('web_tour.tour');

    var _t = core._t;

    tour.register('planning_tour', {
        sequence: 120,
        'skip_enabled': false,
    }, [{
        trigger: '.o_app[data-menu-xmlid="planning.planning_menu_root"]',
        content: _t("Let's start managing your employees' schedule!"),
        position: 'bottom',
    }, {
        trigger: ".o_gantt_button_add",
        content: _t("Create your first shift by clicking on Add. Alternatively, you can use the (+) button on each cell."),
        position: "bottom",
    }, {
        trigger: "button[special='save']",
        content: _t("Save this shift once it is ready."),
        position: "bottom",
    }, {
        trigger: ".o_gantt_button_send_all",
        content: _t("Send the schedule to your employees once it is ready."),
        position: "right",
    },{
        trigger: "button[name='action_send']",
        content: _t("Send the schedule and mark the shifts as published. Congratulations!"),
        position: "right",
    },
    ]);
});
