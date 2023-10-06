odoo.define('stock_barcode.InventoryAdjustmentKanbanRenderer', function (require) {
"use strict";

var StockBarcodeKanbanRecord = require('stock_barcode.InventoryAdjustmentKanbanRecord');

var KanbanRenderer = require('web.KanbanRenderer');

var StockBarcodeListKanbanRenderer = KanbanRenderer.extend({
    config: _.extend({}, KanbanRenderer.prototype.config, {
        KanbanRecord: StockBarcodeKanbanRecord,
    })
});

return StockBarcodeListKanbanRenderer;

});
