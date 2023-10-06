odoo.define('industry_fsm_sale.ProductKanbanModel', function (require) {
"use strict";

const KanbanModel = require('web.KanbanModel');

return KanbanModel.extend({

    /**
     * Handles the field `fsm_quantity`.
     * Saving this field cannot be done as any regular field
     * since it might require additional actions from the user.
     * e.g. set product serial numbers
     * @param {string} recordID
     * @param {object} options
     * @returns {Promise<string>} Changed fields
     * @override
     */
    async save(recordID, options) {
        const record = this.localData[recordID];
        const changes = record._changes;
        if (changes.fsm_quantity !== undefined) {
            const quantity = changes.fsm_quantity;
            delete changes.fsm_quantity;
            const changedFields = await Promise.all([
                this._super(...arguments),
                this._saveFSMQuantity(record, quantity),
            ]);
            await this._fetchRecord(record);
            return changedFields.flat();
        }
        return this._super(...arguments);
    },

    /**
     * Saves the FSM quantity.
     * @param {object} record
     * @param {number} quantity
     * @returns {Promise<string>} changed field
     */
    async _saveFSMQuantity(record, quantity) {
        const action = await this._rpc({
            model: 'product.product',
            method: 'set_fsm_quantity',
            args: [record.data.id, quantity],
            context: record.getContext(),
        });
        if (typeof action === 'object') {
            await new Promise((resolve) => {
                this.do_action(action, { on_close: resolve });
            });
        }
        return ['fsm_quantity'];
    },

});

});
