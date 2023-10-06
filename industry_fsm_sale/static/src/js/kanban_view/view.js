odoo.define('industry_fsm_sale.ProductKanbanView', function (require) {
"use strict";

const KanbanView = require('web.KanbanView');
const KanbanModel = require('industry_fsm_sale.ProductKanbanModel');
const viewRegistry = require('web.view_registry');

const ProductKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Model: KanbanModel,
    }),
});

viewRegistry.add('fsm_product_kanban', ProductKanbanView);

});
