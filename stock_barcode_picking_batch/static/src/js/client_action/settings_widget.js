odoo.define('stock_barcode_picking_batch.SettingsWidget', function (require) {
'use strict';

const SettingsWidget = require('stock_barcode.SettingsWidget');

SettingsWidget.include({
    events: Object.assign({}, SettingsWidget.prototype.events, {
        'click .o_print_picking_batch': '_onClickPrintPickingBatch',
    }),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handles the click on the `print picking batch` button.
     * This is specific to the `stock.picking.batch` model.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickPrintPickingBatch: function (ev) {
        ev.stopPropagation();
        this.trigger_up('print_picking_batch');
    },
});

});
