odoo.define('stock_barcode.picking_client_action', function (require) {
'use strict';

var core = require('web.core');
var ClientAction = require('stock_barcode.ClientAction');
var ViewsWidget = require('stock_barcode.ViewsWidget');

var _t = core._t;

var PickingClientAction = ClientAction.extend({
    custom_events: _.extend({}, ClientAction.prototype.custom_events, {
        'change_location': '_onChangeLocation',
        'picking_print_delivery_slip': '_onPrintDeliverySlip',
        'picking_print_picking': '_onPrintPicking',
        'picking_print_barcodes_zpl': '_onPrintBarcodesZpl',
        'picking_print_barcodes_pdf': '_onPrintBarcodesPdf',
        'picking_return': '_onReturn',
        'picking_scrap': '_onScrap',
        'put_in_pack': '_onPutInPack',
        'open_package': '_onOpenPackage',
    }),

    init: function (parent, action) {
        this._super.apply(this, arguments);
        this.context = action.context;
        this.commands['O-BTN.scrap'] = this._scrap.bind(this);
        this.commands['O-BTN.validate'] = this._validate.bind(this);
        this.commands['O-BTN.cancel'] = this._cancel.bind(this);
        this.commands['O-BTN.pack'] = this._putInPack.bind(this);
        this.commands['O-BTN.print-op'] = this._printPicking.bind(this);
        if (! this.actionParams.id) {
            this.actionParams.id = action.context.active_id;
            this.actionParams.model = 'stock.picking';
        }
        this.methods = {
            cancel: 'action_cancel',
            validate: 'button_validate',
        };
        this.viewInfo = 'stock_barcode.stock_picking_barcode';
    },

    willStart: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            // Bind the print slip command here to be able to pass the action as argument.
            self.commands['O-BTN.print-slip'] = self._printReport.bind(self, self.currentState.actionReportBarcodesZplId);
            // Get the usage of the picking type of `this.picking_id` to chose the mode between
            // `receipt`, `internal`, `delivery`.
            var picking_type_code = self.currentState.picking_type_code;
            var picking_state = self.currentState.state;
            if (picking_type_code === 'incoming') {
                self.mode = 'receipt';
            } else if (picking_type_code === 'outgoing') {
                self.mode = 'delivery';
            } else {
                self.mode = 'internal';
            }

            if (self.currentState.group_stock_multi_locations === false) {
                self.mode = 'no_multi_locations';
            }

            if (picking_state === 'done') {
                self.mode = 'done';
            } else if (picking_state === 'cancel') {
                self.mode = 'cancel';
            }
            self.allow_scrap = (
                (picking_type_code === 'incoming') && (picking_state === 'done') ||
                (picking_type_code === 'outgoing') && (picking_state !== 'done') ||
                (picking_type_code === 'internal')
            );

            self.isImmediatePicking = self.currentState.immediate_transfer;
            self.usablePackagesByBarcode = self.currentState.usable_packages || {};
            self.requireLotNumber = self.currentState.use_create_lots || self.currentState.use_existing_lots;
        });
    },

    start: function () {
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._toggleKeyEvents(true);
        return this._super(...arguments);
    },

    destroy: function () {
        this._toggleKeyEvents(false);
        this._super();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Applies new destination or source location for all page's lines and then refresh it.
     *
     * @private
     * @param {number} locationId
     * @param {boolean} isSource true for the source, false for destination
     */
    _changeLocation: function (locationId, isSource) {
        const currentPage = this.pages[this.currentPageIndex];
        const sourceLocation = isSource ? locationId : currentPage.location_id;
        const destinationLocation = isSource ? currentPage.location_dest_id : locationId;
        const fieldName = isSource ? 'location_id' : 'location_dest_id';
        const currentPageLocationId = currentPage[fieldName];
        if (currentPageLocationId === locationId) {
            // Do nothing if the user try to change for the current page.
            return;
        }

        this.mutex.exec(() => {
            const locations = isSource ? this.sourceLocations : this.destinationLocations;
            const locationData = _.find(locations, (location) => location.id === locationId);
            // Apply the selected location on the page's lines.
            for (const line of currentPage.lines) {
                line[fieldName] = locationData;
            }
            return this._save().then(() => {
                // Find the page index (because due to the change, the page
                // could be to another place in the pages list).
                for (let i = 0; i < this.pages.length; i++) {
                    const page = this.pages[i];
                    if (page.location_id === sourceLocation &&
                        page.location_dest_id === destinationLocation) {
                        this.currentPageIndex = i;
                        break;
                    }
                }
                const prom = this._reloadLineWidget(this.currentPageIndex);
                this._endBarcodeFlow();
                return prom;
            });
        });
    },

    /**
     * @override
     */
    _createLineCommand: function (line) {
        return [0, 0, {
            picking_id: line.picking_id,
            product_id:  line.product_id.id,
            product_uom_id: line.product_uom_id[0],
            qty_done: line.qty_done,
            location_id: line.location_id.id,
            location_dest_id: line.location_dest_id.id,
            lot_name: line.lot_name,
            lot_id: line.lot_id && line.lot_id[0],
            state: 'assigned',
            owner_id: line.owner_id && line.owner_id[0],
            package_id: line.package_id ? line.package_id[0] : false,
            result_package_id: line.result_package_id ? line.result_package_id[0] : false,
            dummy_id: line.virtual_id,
        }];
    },

    /**
     * @override
     */
    _getAddLineDefaultValues: function (currentPage) {
        const values = this._super(currentPage);
        values.default_location_dest_id = currentPage.location_dest_id;
        values.default_picking_id = this.currentState.id;
        values.default_qty_done = 1;
        return values;
    },

    /**
     * @override
     */
    _getLines: (state) => state.move_line_ids,

    /**
     * @override
     */
    _getState: function () {
        const superProm = this._super(...arguments);
        if (this.groups.group_tracking_lot) {
            // If packages are enabled, checks to add new `result_package_id` as usable package.
            superProm.then(res => {
                this.usablePackagesByBarcode = res[0].usable_packages;
            });
        }
        return superProm;
    },

    /**
     * @override
     */
    _lot_name_used: function (product, lot_name) {
        var lines = this._getLines(this.currentState);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.qty_done !== 0 && line.product_id.id === product.id &&
                (line.lot_name && line.lot_name === lot_name)) {
                return true;
            }
        }
        return false;
    },

    /**
     * @override
     */
    _getPageFields: function () {
        return [
            ['location_id', 'location_id.id'],
            ['location_name', 'location_id.display_name'],
            ['location_dest_id', 'location_dest_id.id'],
            ['location_dest_name', 'location_dest_id.display_name'],
        ];
    },

    /**
     * @override
     */
    _getWriteableFields: function () {
        return ['qty_done', 'location_id.id', 'location_dest_id.id', 'lot_name', 'lot_id.id', 'result_package_id', 'owner_id.id'];
    },

    /**
     * @override
     */
    _getLinesField: function () {
        return 'move_line_ids';
    },

    /**
     * @override
     */
    _getQuantityField: function () {
        return 'qty_done';
    },

    /**
     * @override
     */
    _instantiateViewsWidget: function (defaultValues, params) {
        this._toggleKeyEvents(false);
        return new ViewsWidget(
            this,
            'stock.move.line',
            'stock_barcode.stock_move_line_product_selector',
            defaultValues,
            params
        );
    },

    /**
     * @override
     */
    _isPickingRelated: function () {
        return true;
    },


    /**
     * @override
     */
    _makeNewLine: function (params) {
        var virtualId = this._getNewVirtualId();
        var currentPage = this.pages[this.currentPageIndex];
        var newLine = {
            'picking_id': this.currentState.id,
            'product_id': {
                'id': params.product.id,
                'display_name': params.product.display_name,
                'barcode': params.barcode,
                'tracking': params.product.tracking,
            },
            'product_barcode': params.barcode,
            'display_name': params.product.display_name,
            'product_uom_qty': 0,
            'product_uom_id': params.product.uom_id,
            'qty_done': params.qty_done,
            'location_id': {
                'id': currentPage.location_id,
                'display_name': currentPage.location_name,
            },
            'location_dest_id': {
                'id': currentPage.location_dest_id,
                'display_name': currentPage.location_dest_name,
            },
            'package_id': params.package_id,
            'result_package_id': params.result_package_id,
            'owner_id': params.owner_id,
            'state': 'assigned',
            'reference': this.name,
            'virtual_id': virtualId,
            'owner_id': params.owner_id,
        };
        return newLine;
    },

    /**
     * This method could open a wizard so it takes care of removing/adding the
     * "barcode_scanned" event listener.
     *
     * @override
     */
    _validate: function (context) {
        const self = this;
        const superValidate = this._super.bind(this);
        this.mutex.exec(function () {
            const successCallback = function () {
                self.displayNotification({
                    message: _t("The transfer has been validated"),
                    type: 'success',
                });
                self.trigger_up('exit');
            };
            const exitCallback = function (infos) {
                if ((infos === undefined || !infos.special) && this.dialog.$modal.is(':visible')) {
                    successCallback();
                }
                core.bus.on('barcode_scanned', self, self._onBarcodeScannedHandler);
            };

            return superValidate(context).then((res) => {
                if (_.isObject(res)) {
                    const options = {
                        on_close: exitCallback,
                    };
                    core.bus.off('barcode_scanned', self, self._onBarcodeScannedHandler);
                    return self.do_action(res, options);
                } else {
                    return successCallback();
                }
            });
        });
    },

    /**
     * @override
     */
    _cancel: function () {
        const superCancel = this._super.bind(this);
        this.mutex.exec(() => {
            return superCancel().then(() => {
                this.do_notify(false, _t("The transfer has been cancelled"));
                this.trigger_up('exit');
            });
        });
    },

    /**
     * Makes the rpc to `button_scrap`.
     * This method opens a wizard so it takes care of removing/adding the "barcode_scanned" event
     * listener.
     *
     * @private
     */
    _scrap: function () {
        var self = this;
        this.mutex.exec(function () {
            return self._save().then(function () {
                return self._rpc({
                    'model': 'stock.picking',
                    'method': 'button_scrap',
                    'args': [[self.actionParams.id]],
                }).then(function(res) {
                    var exitCallback = function () {
                        core.bus.on('barcode_scanned', self, self._onBarcodeScannedHandler);
                    };
                    var options = {
                        on_close: exitCallback,
                    };
                    core.bus.off('barcode_scanned', self, self._onBarcodeScannedHandler);
                    return self.do_action(res, options);
                });
            });
        });
    },


    /**
     *
     */
    _putInPack: function () {
        var self = this;
        if (this.currentState.group_tracking_lot === false) {
            this.do_warn(false, _t("To use packages, enable 'Delivery Packages' from the settings"));
            return;
        }
        this.mutex.exec(function () {
            return self._save().then(function () {
                return self._rpc({
                    'model': self.actionParams.model,
                    'method': 'action_put_in_pack',
                    'args': [[self.actionParams.id]],
                    kwargs: {
                        context: _.extend({}, self.context || {}, {barcode_view: true})
                    },
                }).then(function (res) {
                    var def = Promise.resolve();
                    self._endBarcodeFlow();
                    if (res.type && res.type === 'ir.actions.act_window') {
                        var exitCallback = function (infos) {
                            if (infos === undefined || !infos.special) {
                                self.trigger_up('reload');
                            }
                            core.bus.on('barcode_scanned', self, self._onBarcodeScannedHandler);
                        };
                        var options = {
                            on_close: exitCallback,
                        };
                        return def.then(function () {
                            core.bus.off('barcode_scanned', self, self._onBarcodeScannedHandler);
                            return self.do_action(res, options);
                        });
                    } else {
                        return def.then(function () {
                            return self.trigger_up('reload');
                        });
                    }
                });
            });
        });
    },

    /**
     * Handles the `open_package` OdooEvent. It hides the main widget and
     * display a standard kanban view with all quants inside the package.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onOpenPackage: function (ev) {
        var self = this;

        ev.stopPropagation();
        this.linesWidget.destroy();
        this.headerWidget.toggleDisplayContext('specialized');

        var virtual_id = _.isString(ev.data.id) ? ev.data.id : false;
        this.mutex.exec(function () {
            return self._save().then(function () {
                var currentPage = self.pages[self.currentPageIndex];
                var id = ev.data.id;
                if (virtual_id) {
                    var rec = _.find(currentPage.lines, function (line) {
                        return line.dummy_id === virtual_id;
                    });
                    id = rec.id;
                }
                var package_id = _.find(currentPage.lines, function (line) {
                    return line.id === id;
                });
                package_id = package_id.package_id[0];

                var params = {
                    searchQuery: {
                        context: self.context,
                        domain: [['package_id', '=', package_id]],
                    },
                };
                self.ViewsWidget = new ViewsWidget(self, 'stock.quant', 'stock_barcode.stock_quant_barcode_kanban', {}, params, false, 'kanban');
                return self.ViewsWidget.appendTo(self.$('.o_content'));
            });
        });
    },


    _printPicking: function () {
        var self = this;
        this.mutex.exec(function () {
            return self._save().then(function () {
                return self._rpc({
                    'model': 'stock.picking',
                    'method': 'do_print_picking',
                    'args': [[self.actionParams.id]],
                }).then(function(res) {
                    return self.do_action(res);
                });
            });
        });
    },

    /**
     * Calls the action to print the according report.
     *
     * @param {integer} action id of the report action
     */
    _printReport: function (action) {
        this.mutex.exec(() => {
            return this._save().then(() => {
                return this.do_action(action, {
                    additional_context: {
                        active_id: this.actionParams.id,
                        active_ids: [this.actionParams.id],
                        active_model: 'stock.picking',
                    }
                });
            });
        });
    },

    /**
     * Set the result package on the current line.
     * Called by `_step_reusable_package` when user scans a reusable package.
     *
     * @param {Object} currentLine
     * @param {Object} usablePackage
     */
    _setPackageOnLine: function (currentLine, usablePackage) {
        currentLine.result_package_id = [usablePackage.id, usablePackage.name];
    },

    /**
     * Enables or disables the `keydown` and `keyup` event.
     * They are toggled when passing through the form view (edit or add a line).
     *
     * @param {boolean} mustBeActive
     */
    _toggleKeyEvents: function (mustBeActive) {
        if (mustBeActive) {
            document.addEventListener('keydown', this._onKeyDown);
            document.addEventListener('keyup', this._onKeyUp);
        } else {
            document.removeEventListener('keydown', this._onKeyDown);
            document.removeEventListener('keyup', this._onKeyUp);
        }
    },

    /**
     * @override
     */
    _updateLineCommand: function (line) {
        return [1, line.id, {
            qty_done : line.qty_done,
            location_id: line.location_id.id,
            location_dest_id: line.location_dest_id.id,
            lot_id: line.lot_id && line.lot_id[0],
            lot_name: line.lot_name,
            owner_id: line.owner_id && line.owner_id[0],
            package_id: line.package_id ? line.package_id[0] : false,
            result_package_id: line.result_package_id ? line.result_package_id[0] : false,
        }];
    },

    // -------------------------------------------------------------------------
    // Private: flow steps
    // -------------------------------------------------------------------------

    /**
     * @override
     */
    _step_lot: function (barcode, linesActions) {
        // Bypass this step if needed.
        let prom = Promise.reject();
        if (this.usablePackagesByBarcode[barcode]) {
            prom = this._step_reusable_package(barcode, linesActions);
        }
        return prom.catch(this._super.bind(this, ...arguments));
    },

    /**
     * @override
     */
    _step_product: function (barcode, linesActions) {
        // Bypass this step if needed.
        if (this.usablePackagesByBarcode[barcode]) {
            return this._step_reusable_package(barcode, linesActions);
        }
        return this._super(...arguments);
    },

    /**
     * Handles scanning a package to use it as `result_package_id`.
     * Checks if the scanned package can be used to pack the product.
     *
     * @param {string} barcode
     * @param {Array} linesActions
     * @returns {Promise}
     */
    _step_reusable_package: function (barcode, linesActions) {
        const usablePackage = this.usablePackagesByBarcode[barcode];
        if (usablePackage.location_id && usablePackage.location_id[0] !== this.pages[this.currentPageIndex].location_dest_id) {
            if (usablePackage.location_id[0] === this.pages[this.currentPageIndex].location_id) {
                // If the package is not at the picking's destination but is at the picking's source
                // location, it can't be used as the `result_package_id` but it can be processed as
                // usual package (get back its quants and create/update a line for each one of them)
                return this._step_package(barcode, linesActions);
            }
            return Promise.reject(_t("The scanned package must not be assigned to a location or must be assigned to the current dest location."));
        }
        // Set the result package on the last scanned line.
        const lineId = this.scannedLines[this.scannedLines.length - 1];
        const lines = this._getLines(this.currentState);
        const currentLine = lines.find(line => line.id === lineId || line.virtual_id === lineId);
        // No line found -> Need to scan a product first.
        if (!currentLine) {
            return Promise.reject();
        }
        this._setPackageOnLine(currentLine, usablePackage);
        linesActions.push([
            this.linesWidget._applyPackage,
            [currentLine.id || currentLine.virtual_id, usablePackage],
        ]);
        return Promise.resolve({linesActions: linesActions});
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handles the `change_location` OdooEvent. It will change location for move lines.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onChangeLocation: function (ev) {
        ev.stopPropagation();
        this._changeLocation(ev.data.locationId, ev.data.isSource);
    },

    /**
     * Listens for shift key being pushed for display the remaining qty instead of only the "+1".
     *
     * Assumptions:
     * - We don't need to worry about Caps Lock being active because it's a huge pain to detect
     *   and probably can't be until the first letter is pushed.
     *
     * @private
     * @param {KeyboardEvent} keyDownEvent
     */
    _onKeyDown: function (keyDownEvent) {
        if (this.linesWidget && keyDownEvent.key === 'Shift' &&
            !keyDownEvent.repeat && !keyDownEvent.ctrlKey && !keyDownEvent.metaKey) {
            this.linesWidget._applyShiftKeyDown();
        }
    },

    /**
     * Listens for shift being released to only display the "+1". There's no
     * reliable way to distinguish between 1 or 2 shift buttons being pushed (without
     * a tedious tracking variable), so let's assume the user won't push both down at
     * the same time and still expect it to work properly.
     *
     * @private
     * @param {KeyboardEvent} keyUpEvent
     */
    _onKeyUp: function (keyUpEvent) {
        if (this.linesWidget && keyUpEvent.key === 'Shift') {
            this.linesWidget._applyShiftKeyUp();
        }
    },

    /**
     * Handles the `print_picking` OdooEvent. It makes an RPC call
     * to the method 'do_print_picking'.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onPrintPicking: function (ev) {
        ev.stopPropagation();
        this._printPicking();
    },

    /**
     * Handles the `print_delivery_slip` OdooEvent. It makes an RPC call
     * to the method 'do_action' on a 'ir.action_window' with the additional context
     * needed
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onPrintDeliverySlip: function (ev) {
        ev.stopPropagation();
        this._printReport(this.currentState.actionReportDeliverySlipId);
    },

    /**
     * Handles the `print_barcodes_zpl` OdooEvent. It makes an RPC call
     * to the method 'do_print_barcodes_zpl'.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onPrintBarcodesZpl: function (ev) {
        ev.stopPropagation();
        this._printReport(this.currentState.actionReportBarcodesZplId);
    },

    /**
     * Handles the `print_barcodes_pdf` OdooEvent. It makes an RPC call
     * to the method 'do_print_barcodes_zpl'.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onPrintBarcodesPdf: function (ev) {
        ev.stopPropagation();
        this._printReport(this.currentState.actionReportBarcodesPdfId);
    },

    /**
     * @override
     */
    _onReload: function (ev) {
        this._super(...arguments);
        this._toggleKeyEvents(true);
    },

    /**
     * Handles the `picking_return` OdooEvent and opens the return wizard.
     * As this method opens a wizard, it takes care of removing/adding the
     * "barcode_scanned" event listener.
     *
     * @param {OdooEvent} ev
     */
    _onReturn: function (ev) {
        ev.stopPropagation();
        this.mutex.exec(() => {
            return this._save().then(() => {
                const exitCallback = function () {
                    core.bus.on('barcode_scanned', this, this._onBarcodeScannedHandler);
                };
                const options = {
                    additional_context: {
                        active_id: this.currentState.id,
                        active_model: 'stock.picking',
                    },
                    on_close: exitCallback.bind(this),
                };
                core.bus.off('barcode_scanned', this, this._onBarcodeScannedHandler);
                return this.do_action(this.currentState.actionReturn, options);
            });
        });
    },

    /**
     * Handles the `scan` OdooEvent. It makes an RPC call
     * to the method 'button_scrap' to scrap a picking.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onScrap: function (ev) {
        ev.stopPropagation();
        this._scrap();
    },

    /**
     * Handles the `Put in pack` OdooEvent. It makes an RPC call
     * to the method 'action_put_in_pack' to create a pack and link move lines to it.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onPutInPack: function (ev) {
        ev.stopPropagation();
        this._putInPack();
    },
});

core.action_registry.add('stock_barcode_picking_client_action', PickingClientAction);

return PickingClientAction;

});
