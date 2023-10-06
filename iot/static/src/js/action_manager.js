odoo.define('iot.ActionManager', function (require) {
'use strict';

var core = require('web.core');
var ActionManager = require('web.ActionManager');
var DeviceProxy = require('iot.DeviceProxy');

var _t = core._t;

ActionManager.include({
    _executeReportAction: function (action) {
        const options = arguments[1];
        if (action.device_id) {
            // Call new route that sends you report to send to printer
            var self = this;
            self.action = action;
            action.data = {};
            action.data["device_id"] = action.device_id;
            return this._rpc({
                model: 'ir.actions.report',
                method: 'iot_render',
                args: [action.id, action.context.active_ids, action.data]
            }).then(function (result) {
                var iot_device = new DeviceProxy(self, { iot_ip: result[0], identifier: result[1] });
                iot_device.add_listener(self._onValueChange.bind(self));
                return iot_device.action({'document': result[2]})
                    .then(function(data) {
                        return self._onIoTActionResult.call(self, data).then(options.on_close.bind(self));
                    }).guardedCatch(self._onIoTActionFail.bind(self, result[0]));
            });
        }
        else {
            return this._super.apply(this, arguments);
        }
    },

    _onIoTActionResult: function (data){
        if (data.result === true) {
            this.do_notify(false, _t('Successfully sent to printer!'));
            return Promise.resolve();
        } else {
            this.do_warn(_t('Connection to printer failed'), _t('Check if the printer is still connected'));
            return Promise.reject();
        }
    },

    _onIoTActionFail: function (ip){
        // Display the generic warning message when the connection to the IoT box failed.
        this.call('iot_longpolling', '_doWarnFail', ip);
    },

    _onValueChange: function (data) {
        if (data.status) {
            this.do_notify(false, _t("Printer ") + data.status);
        }
    }
});

return ActionManager;

});
