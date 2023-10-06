odoo.define('stock_barcode_picking_batch.LinesWidget', function (require) {
'use strict';

const LinesWidget = require('stock_barcode.LinesWidget');

LinesWidget.include({

    /**
     * Sorting function for picking lines. This function sorts by picking name first so this order follows
     * when other sorting criteria are equal.
     *
     * @override
     */
    _sortProductLines: function (lines) {
        if (this.model === 'stock.picking.batch') {
            lines.sort(function(a,b) {
                return a.picking_id.name > b.picking_id.name ? 1 : a.picking_id.name < b.picking_id.name ? -1 : 0;
            });
        }
        return this._super.apply(this, arguments);
    },

    /**
     * @override
     */
    _getErrorName: function () {
        const errorNames = this._super.apply(this);
        errorNames.push(
            'picking_batch_already_done',
            'picking_batch_already_cancelled',
            'picking_batch_draft',
            'picking_batch_empty'
        );
        return errorNames;
    },

    /**
     * @override
     */
    _renderLines: function () {
        if (this.model === 'stock.picking.batch') {
            if (this.mode === 'done') {
                this._toggleScanMessage('picking_batch_already_done');
                return;
            } else if (this.mode === 'cancel') {
                this._toggleScanMessage('picking_batch_already_cancelled');
                return;
            } else if (this.mode === 'draft') {
                this._toggleScanMessage('picking_batch_draft');
                return;
            } else if (this.nbPages === 0) {
                this._toggleScanMessage('picking_batch_empty');
                return;
            }
        }
        return this._super.apply(this, arguments);
    }
});

});
