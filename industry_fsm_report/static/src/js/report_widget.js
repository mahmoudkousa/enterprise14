odoo.define('industry_fsm_report.report_button', function (require) {
"use strict";


var core = require('web.core');
var widget_registry = require('web.widget_registry');
var Widget = require('web.Widget');

var _t = core._t;


var OpenStudioButton = Widget.extend({
    tagName: 'button',
    className: 'o_fsm_report_button btn btn-primary d-none d-md-block',
    events: {
        'click': '_onButtonClick',
    },

    /**
     * @override
     */
    init: function(parent, record) {
        this.record = record;
        this._super.apply(this, arguments);
    },

    /**
     * @override
     */
    start: function () {
        this._super.apply(this, arguments);
        this.$el.text(_t('Design Worksheet Template'));
    },

    /**
     * @override
     * @private
     */
    _onButtonClick: function (event) {
        var self = this;
        this._rpc({
            'model': 'project.worksheet.template',
            'method': 'get_x_model_form_action',
            'args': [this.record.res_id]
        })
        .then(function (act) {
            return self.do_action(act);
        })
        .then(function () {
            self.trigger_up('studio_icon_clicked');
        });
    }
});

widget_registry.add('open_studio_button', OpenStudioButton);

});
