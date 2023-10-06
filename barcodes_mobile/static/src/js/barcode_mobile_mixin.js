odoo.define('web_mobile.barcode_mobile_mixin', function (require) {
"use strict";

const mobile = require('web_mobile.core');

return {
    events: {
        'click .o_mobile_barcode': 'open_mobile_scanner'
    },
    async start() {
        const res = await this._super(...arguments);
        if (!mobile.methods.scanBarcode) {
            this.$el.find(".o_mobile_barcode").remove();
        }
        return res;
    },
    async open_mobile_scanner() {
        const response = await mobile.methods.scanBarcode();
        const barcode = response.data;
        if (barcode) {
            this._onBarcodeScanned(barcode);
            mobile.methods.vibrate({'duration': 100});
        } else {
            mobile.methods.showToast({'message': 'Please, Scan again !!'});
        }
    }
};
});
