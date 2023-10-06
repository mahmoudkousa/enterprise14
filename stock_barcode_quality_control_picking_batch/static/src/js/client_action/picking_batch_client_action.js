odoo.define('stock_barcode.picking_batch_quality_client_action', function (require) {
'use strict';

const core = require('web.core');
const BatchPickingClientAction = require('stock_barcode.BatchPickingClientAction');

const _t = core._t;

BatchPickingClientAction.include({
    custom_events: Object.assign({}, BatchPickingClientAction.prototype.custom_events, {
        'picking_check_quality': '_onCheckQuality',
    }),

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _checkQuality: function () {
        this.mutex.exec(() => {
            return this._save().then(() => {
                return this._rpc({
                    'model': 'stock.picking.batch',
                    'method': 'action_open_quality_check',
                    'args': [[this.actionParams.id]],
                }).then((res) => {
                    const exitCallback = () => {
                        this.trigger_up('reload');
                    };
                    if (_.isObject(res)) {
                        const options = {
                            on_close: exitCallback,
                        };
                        return this.do_action(res, options);
                    } else {
                        this.do_notify(false, _t("All the quality checks have been done"));
                    }
                });
            });
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handle the `_checkQuality` method.
     */
    _onCheckQuality: function (ev) {
        ev.stopPropagation();
        this._checkQuality();
    },
});

return BatchPickingClientAction;

});
