odoo.define('stock_barcode.mrp_subcontracting_picking_client_action', function (require) {
'use strict';

var core = require('web.core');
var PickingClientAction = require('stock_barcode.picking_client_action');

var _t = core._t;

var MrpSubcontractingPickingClientAction = PickingClientAction.include({
    custom_events: _.extend({}, PickingClientAction.prototype.custom_events, {
        'action_show_subcontract_details': '_onActionShowSubcontractDetails',
        'action_record_components': '_onRecordComponents',
    }),

    init: function (parent, action) {
        this._super.apply(this, arguments);
        this.commands['O-BTN.record-components'] = this._actionRecordComponents.bind(this);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _actionRecordComponents: function (moveId) {
        var self = this;
        return self._save().then(function () {
            return self._getActionRecordComponents(moveId).then(function (res) {
                self.do_action(res[0], res[1]);
            }, function (errorMessage) {
                self.do_warn(false, errorMessage);
            });
        });
    },

    _actionShowSubcontractDetails: function (moveId) {
        var self = this;
        return self._save().then(function () {
            return self._rpc({
                'model': 'stock.move',
                'method': 'action_show_subcontract_details',
                'args': [[moveId]],
            }).then(function (res) {
                var exitCallback = function () {
                    self.trigger_up('reload');
                };
                var options = {
                    on_close: exitCallback,
                };
                return self.do_action(res, options);
            });
        });
    },

    /**
     * This function is needed and can't be move inside _actionRecordComponents
     * since _step_product and _step_lot return a do_action with the action and
     * its options.
     *
     * @private
     * @return {Promise}
     */
    _getActionRecordComponents: function (moveId) {
        var def;
        var self = this;
        if (moveId) {
            def = this._rpc({
                'model': 'stock.move',
                'method': 'action_show_details',
                'args': [[moveId]],
            });
        } else {
            def = this._rpc({
                'model': 'stock.picking',
                'method': 'action_record_components',
                'args': [[this.actionParams.id]],
            });
        }
        return def.then(function (res) {
            if (! res) {
                var errorMessage = _t('No components to register');
                return Promise.reject(errorMessage);
            }
            var exitCallback = function () {
                self.trigger_up('reload');
            };
            var options = {
                on_close: exitCallback,
            };
            return Promise.resolve([res, options]);
        });
    },

    _hasSubcontractedProduct: function (linesActions, moveLineIds) {
        var linesToCheck = _.filter(linesActions.slice(linesActions), function (lineAction) {
            return lineAction[0].name === 'incrementProduct';
        });
        var linesToCheckIds = _.map(linesToCheck, function (lineAction) {
            return lineAction[1][0];
        });
        var subcontractLines = _.filter(moveLineIds, function (moveLineId) {
            return linesToCheckIds.indexOf(moveLineId.id) !== -1 && moveLineId.is_subcontract;
        });
        return subcontractLines;
    },

    _step_subcontract: function (linesActions, linesActionsIndex) { 
        var self = this;
        var newLinesActions = linesActions.slice(linesActionsIndex);
        var subcontractLines = self._hasSubcontractedProduct(newLinesActions, self.currentState.move_line_ids);
        if (subcontractLines.length) {
            return self._discard().then(function () {
                return self._getActionRecordComponents(subcontractLines[0].move_id[0]).then(function (res) {
                    return Promise.resolve({
                        linesActions: [[self.linesWidget.do_action, res]]
                    });
                });
            });
        }
        return Promise.resolve({linesActions: linesActions});
    },

    /**
     * @override
     */
    _step_product: function (barcode, linesActions) {
        var self = this;
        var linesActionsIndex = linesActions.length;
        return this._super.apply(this, arguments).then(function (res) {
            return self._step_subcontract(res.linesActions, linesActionsIndex);
        });
    },

    /**
     * @override
     */
    _step_lot: function (barcode, linesActions) {
        var self = this;
        var linesActionsIndex = linesActions.length;
        return this._super.apply(this, arguments).then(function (res) {
            return self._step_subcontract(res.linesActions, linesActionsIndex);
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onActionShowSubcontractDetails: function (ev) {
        ev.stopPropagation();
        var self = this;
        this.mutex.exec(function () {
            return self._actionShowSubcontractDetails(ev.data.move_id);
        });
    },

    _onRecordComponents: function (ev) {
        ev.stopPropagation();
        var self = this;
        this.mutex.exec(function () {
            return self._actionRecordComponents();
        });
    },


});
return MrpSubcontractingPickingClientAction;

});
