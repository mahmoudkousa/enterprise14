odoo.define('delivery_iot.iot_widgets', function (require) {
'use strict';

var AbstractService = require('web.AbstractService');
var core = require('web.core');
var FieldMany2One = require('web.relational_fields').FieldMany2One;
var field_registry = require('web.field_registry');
var iot_widgets = require('iot.widgets');
var DeviceProxy = require('iot.DeviceProxy');

var FieldMany2OneIoTScale = FieldMany2One.extend(iot_widgets.IoTValueFieldMixin, {
    template: "FieldMany2OneIoTScale",
    events: _.extend({}, FieldMany2One.prototype.events, {
        'click .o_read_weight': '_onClickReadWeight',
    }),

    _onClickReadWeight: function () {
        this.iot_device.action({ action: 'read_once' });
    },

    /**
     * @override
     */
    _reset: function () {
        this._super.apply(this, arguments);
        if (!this.iot_device || this.iot_device._identifier != this.recordData.iot_device_identifier) {
            this._stopListening();
            this._getDeviceInfo();
            this._startListening();
        }
    },

    _renderEdit: function () {
        this._super.apply(this, arguments);
        if (this.manual_measurement) {
            this.$el.find('.o_read_weight').removeClass('o_hidden');
        } else {
            this.$el.find('.o_read_weight').addClass('o_hidden');
        }
    },

    /**
     * @override
     */
    _getDeviceInfo: function () {
        iot_widgets.IoTValueFieldMixin._getDeviceInfo.apply(this);
        this.manual_measurement = this.recordData[this.attrs.options.manual_measurement_field];
    },

    /**
     * @private
     * @override
     * @param {Object} data
     */
    _onValueChange: function (data) {
        var changes = {};
        changes[this.attrs.options.value_field] = data.value;
        this.trigger_up('field_changed', {
            dataPointID: this.record.id,
            changes: changes,
        });
    },

    /**
     * @override
     */
    _startListening: function () {
        iot_widgets.IoTValueFieldMixin._startListening.apply(this);
        if (this.iot_device && !this.manual_measurement) {
            this.iot_device.action({ action: 'start_reading' });
        }
    },

    /**
     * @override
     */
    _stopListening: function () {
        if (this.iot_device && !this.manual_measurement) {
            this.iot_device.action({ action: 'stop_reading' });
        }
        iot_widgets.IoTValueFieldMixin._stopListening.apply(this);
    },
});

field_registry.add('field_many2one_iot_scale', FieldMany2OneIoTScale);

var DeliveryIoTNotificationManager = AbstractService.extend({
    /**
     * @override
     */
    start: function () {
        this._super.apply(this, arguments);
        this.call('bus_service', 'onNotification', this, this._onNotification);
    },

    /**
     * @private
     * @param {Object[]} notifs
     */
    _onNotification: function (notifs) {
        var self = this;
        _.each(notifs, function (notif) {
            var model = notif[0][1];
            var data = notif[1];
            if (model === 'res.partner' && data.type === 'iot_print_documents' && self.call('bus_service', 'isMasterTab')) {
                self._printDocuments(data.iot_device_identifier, data.iot_ip, data.documents, data.iot_idempotent_ids);
            }
        });
    },

    /**
     * @private
     * @param {String} identifier
     * @param {String} iot_ip
     * @param {String[]} documents
     * @param {integer[]} iot_idempotent_ids
     */
    _printDocuments: function (identifier, iot_ip, documents, iot_idempotent_ids) {
        var iot_device = new DeviceProxy(this, {identifier: identifier, iot_ip: iot_ip});
        documents.forEach(function (document, i) {
            iot_device.action({'document': document, 'iot_idempotent_id': iot_idempotent_ids && iot_idempotent_ids[i]});
        });
    },
});

core.serviceRegistry.add('delivery_iot_notification_service', DeliveryIoTNotificationManager);

return {
    FieldMany2OneIoTtScale: FieldMany2OneIoTScale,
    DeliveryIoTNotificationManager: DeliveryIoTNotificationManager,
}

});
