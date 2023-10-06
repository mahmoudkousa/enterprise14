odoo.define('send_hmrc_button', function (require) {
    "use strict";

    var core = require('web.core');
    var framework = require('web.framework');
    var widgetRegistry = require('web.widget_registry');
    var Widget = require('web.Widget');

    var _t = core._t;

    var SendHmrcButton = Widget.extend({
        template: 'SendHmrcButton',
        events: {
            'click': '_onClickRetrieveClientInfo',
        },

        /**
         * @constructor
         * @param {Widget} parent
         * @param {Object} record
         */
        init: function (parent, record, nodeInfo) {
            this._super.apply(this, arguments);
            this.record = record;
        },

        /**
         * @override
         */
        start: function () {
            return this._super.apply(this, arguments);
        },

        /**
         * Retrieve client informations to send them trought the header
         *
         * @private
         * @param {Event} ev
         */
        _onClickRetrieveClientInfo: async function (ev) {

            if (!localStorage.getItem('hmrc_gov_client_device_id')) {
                localStorage.setItem('hmrc_gov_client_device_id', this.record.data.hmrc_gov_client_device_id);
            }

            const clientInfo = {
                'screen_width': screen.width,
                'screen_height': screen.height,
                'screen_scaling_factor': window.devicePixelRatio,
                'screen_color_depth': screen.colorDepth,
                'window_width': window.outerWidth,
                'window_height': window.outerHeight,
                'hmrc_gov_client_device_id': localStorage.getItem('hmrc_gov_client_device_id'),
            }

            var obligation = this.getParent().state.data.obligation_id // Many2one  selection field
            this._rpc({
                model: obligation.model,
                method: 'action_submit_vat_return',
                args: [obligation.res_id, clientInfo],
            });
        }

    });

    widgetRegistry.add('send_hmrc_button', SendHmrcButton);

    return SendHmrcButton;
});
