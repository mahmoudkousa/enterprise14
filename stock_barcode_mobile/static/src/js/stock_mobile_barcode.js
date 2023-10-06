odoo.define('web.stock.mobile_barcode', function (require) {
"use strict";

var linesWidget = require('stock_barcode.LinesWidget');
var BarcodeMainMenu = require('stock_barcode.MainMenu').MainMenu;

var config = require('web.config');
var core = require('web.core');

const mobile = require('web_mobile.core');

var _t = core._t;

/**
 * Opens camera for mobile device to scan barcode.
 *
 * @param {Function} callback function that called after barcode scanned sucessfully
 *
 */
function openMobileScanner (callback) {
    mobile.methods.scanBarcode().then(function (response) {
        var barcode = response.data;
        if (barcode){
            callback(barcode);
            mobile.methods.vibrate({'duration': 100});
        } else {
            mobile.methods.showToast({'message':_t('Please, Scan again !!')});
        }
    });
}
BarcodeMainMenu.include({
    events: _.defaults({
        'click .o_stock_mobile_barcode': 'open_mobile_scanner'
    }, BarcodeMainMenu.prototype.events),
    init: function () {
        this.mobileMethods = mobile.methods;
        return this._super.apply(this, arguments);
    },
    open_mobile_scanner: function() {
        var self = this;
        openMobileScanner(function (barcode) {
            self._onBarcodeScanned(barcode);
        });
    }
});

linesWidget.include({
    events: _.defaults({
        'click .o_stock_mobile_barcode': '_onOpenMobileScanner',
    }, linesWidget.prototype.events),
    init: function () {
        this.mobileMethods = mobile.methods;
        return this._super.apply(this, arguments);
    },
    /**
    * Scroll to `$line`.
    * Overide since overflow on mobile is on whole body
    * (instead of lines container for desktop).
    *
    * @private
    * @overide
    * @param {jQueryElement} $body
    * @param {jQueryElement} $line
    */
    _scrollToLine: function ($body, $line) {
        if (config.device.isMobile) {
            $body = $('html, body');
            $body.animate({
                scrollTop: $line.position().top - $body.height() / 2 + $line.height() / 2
            }, 500);
        } else {
            this._super.apply(this, arguments);
        }
    },
    /**
     * Opens camera for mobile device to scan barcode.
     *
     * @private
     *
     */
    _onOpenMobileScanner: function () {
        openMobileScanner(function (barcode) {
            core.bus.trigger("barcode_scanned", barcode);
    });
    },
});

});
