odoo.define("documents_spreadsheet.PivotController", function (require) {
    "use strict";

    const core = require("web.core");
    const config = require('web.config');
    const PivotController = require("web.PivotController");
    const session = require("web.session");
    const SpreadsheetSelectorDialog = require("documents_spreadsheet.SpreadsheetSelectorDialog");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");

    const _t = core._t;
    const GridModel = spreadsheet.Model;
    const uuidv4 = spreadsheet.helpers.uuidv4;

    PivotController.include({
        init() {
            this._super(...arguments);
            session.user_has_group("documents.group_documents_user").then((has_group) => {
                this.canInsertPivot = has_group;
            });
        },

        /**
         * Disable the spreadsheet button when data is empty. It makes no sense
         * to insert an empty pivot in a spreadsheet
         *
         * @override
         */
        updateButtons: function () {
            this._super(...arguments);
            if (!this.$buttons) {
                return;
            }
            const state = this.model.get({ raw: true });
            const noDataDisplayed = !state.hasData || !state.measures.length;
            this.$buttons.filter('.o_pivot_add_spreadsheet').prop('disabled', noDataDisplayed);
        },

        //----------------------------------------------------------------------
        // Handlers
        //----------------------------------------------------------------------

        /**
         * Add export button to insert a pivot in a Workbook.
         * It will prompt a Dialog to choose either a new sheet (and a
         * workspace), or an existing one.
         *
         * @private
         * @param {MouseEvent} ev
         */
        _addIncludedButtons: async function (ev) {
            await this._super(...arguments);
            if ($(ev.target).hasClass("o_pivot_add_spreadsheet")) {
                const spreadsheets = await this._rpc({
                    model: "documents.document",
                    method: "get_spreadsheets_to_display",
                    args: [],
                });
                const dialog = new SpreadsheetSelectorDialog(self, spreadsheets).open();
                dialog.on("confirm", this, this._save_sheet);
            }
        },
        /**
         * @override
         */
        _getRenderButtonContext: function () {
            const context = this._super(...arguments);
            context.canInsertPivot = this.canInsertPivot;
            context.isMobile = config.device.isMobile;
            return context;
        },

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * Initialize a Spreadsheet Model in headless mode.
         * This model can be either created from scratch (workbookData is null)
         * or restored from a saved workbook (workbookData is not null).
         *
         * In case of the model is restored from an existing workbook, a new
         * sheet is created.
         *
         * @param {Object|null} workbookData Data with which to initialise the
         * model
         *
         * @private
         * @returns o_spreadsheet Model
         */
        _initializeModel(workbookData) {
            const isNewModel = !workbookData;
            if (isNewModel) {
                workbookData = {};
            }
            const model = new GridModel(workbookData, {
                mode: "headless",
                evalContext: { env: this.renderer.env },
            });
            if (!isNewModel) {
                // activate the last sheet to insert the pivot sheet at the end.
                const sheets = model.getters.getSheets();
                model.dispatch("ACTIVATE_SHEET", {
                    from: model.getters.getActiveSheet(),
                    to: sheets[sheets.length - 1].id,
                });
                model.dispatch("CREATE_SHEET", { activate: true, id: uuidv4() });
            }
            return model;
        },
        /**
         * Retrieves the sheet data after inserting a pivot.
         * The pivot can be inserted in a new workbook (if workbookData is null)
         * or inserted in a new sheet of an existing workbook.
         *
         * @param {Object|null} workbookData WorkbookData of the existing workbook.
         *
         * @private
         * @returns o_spreadsheet Model
         */
        async _getSpreadsheetModel(workbookData) {
            const payload = this.model.get();
            const pivot = pivotUtils.sanitizePivot(payload);
            const model = this._initializeModel(workbookData);
            await pivotUtils.createPivotCache(pivot, this._rpc.bind(this));
            pivot.lastUpdate = Date.now();
            const anchor = [0, 0];
            model.dispatch("ADD_PIVOT", { pivot, anchor });
            return model;
        },
        /**
         * Retrieves the sheet data after inserting a pivot.
         * The pivot can be inserted in a new workbook (if workbookData is null)
         * or inserted in a new sheet of an existing workbook.
         *
         * @param {Object|null} workbookData WorkbookData of the existing workbook.
         *
         * @private
         * @returns {Object} Data to inject in o_spreadsheet with the new pivot
         * inserted.
         */
        async _getSpreadsheetData(workbookData) {
            const model = await this._getSpreadsheetModel(workbookData);
            return JSON.stringify(model.exportData());
        },
        /**
         * Save a pivot in a Workbook (new or existing) and open the
         * corresponding Workbook.
         *
         * @param {number|false} spreadsheet Id of the document in which the
         *                                   pivot should be inserted. False if
         *                                   it's a new sheet
         *
         * @private
         */
        async _save_sheet(spreadsheet) {
            let documentId;
            let notificationMessage;
            if (!spreadsheet) {
                documentId = await this._rpc({
                    model: "documents.document",
                    method: "create",
                    args: [
                        {
                            name: _t("Untitled spreadsheet"),
                            mimetype: "application/o-spreadsheet",
                            handler: "spreadsheet",
                            raw: await this._getSpreadsheetData(),
                        },
                    ],
                });
                notificationMessage = _t("New spreadsheet created in Documents");
            } else {
                documentId = spreadsheet.id;
                const spreadsheetData = await this._rpc({
                    model: "documents.document",
                    method: "search_read",
                    fields: ["raw"],
                    domain: [["id", "=", documentId]],
                });
                const raw = await this._getSpreadsheetData(
                    JSON.parse(spreadsheetData[0].raw)
                );
                await this._rpc({
                    model: "documents.document",
                    method: "write",
                    args: [[documentId], { raw }],
                });
                notificationMessage = _.str.sprintf(
                    _t("New sheet inserted in '%s'"),
                    spreadsheet.name
                );
            }
            this.displayNotification({
                type: "info",
                message: notificationMessage,
                sticky: false,
            });
            this.do_action({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: documentId,
                },
            });
        },
    });
});
