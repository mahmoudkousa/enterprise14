odoo.define("documents_spreadsheet.SpreadsheetComponent", function (require) {
    "use strict";

    const core = require("web.core");
    const Dialog = require("web.OwlDialog");
    const PivotDialog =require("documents_spreadsheet.PivotDialog")
    const { jsonToBase64 } = require("documents_spreadsheet.pivot_utils");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const {
        convertPivotFormulas,
        absoluteToRelative,
        getCells,
        pivotFormulaRegex,
    } = require("documents_spreadsheet.pivot_utils");

    const Spreadsheet = spreadsheet.Spreadsheet;
    const { useState, useRef, useSubEnv } = owl.hooks;
    const _t = core._t;

    class SpreadsheetComponent extends owl.Component {
        constructor(parent, props) {
            super(...arguments);
            useSubEnv({
                newSpreadsheet: this.newSpreadsheet.bind(this),
                saveAsTemplate: this._saveAsTemplate.bind(this),
                makeCopy: this.makeCopy.bind(this),
                saveData: this.saveData.bind(this),
                openPivotDialog: this.openPivotDialog.bind(this),
            });
            this.state = useState({
                dialog: {
                    isDisplayed: false,
                    title: undefined,
                    isEditText: false,
                    inputContent: undefined,
                },
                pivotDialog: {
                    isDisplayed: false,
                },
            });
            this.spreadsheet = useRef("spreadsheet");
            this.dialogContent = undefined;
            this.pivot = undefined;
            this.insertPivotValueCallback = undefined;
            this.confirmDialog = () => true;
            this.data = props.data;
            this.res_id = props.res_id;
        }
        mounted() {
            if (this.props.showFormulas) {
                this.spreadsheet.comp.model.dispatch("SET_FORMULA_VISIBILITY", { show: true });
            }
            window.onbeforeunload = () => {
                this.saveData();
            };
        }
        willUnmount() {
            window.onbeforeunload = null;
        }
        /**
         * Open a dialog to ask a confirmation to the user.
         *
         * @param {CustomEvent} ev
         * @param {string} ev.detail.content Content to display
         * @param {Function} ev.detail.confirm Callback if the user press 'Confirm'
         */
        askConfirmation(ev) {
            this.dialogContent = ev.detail.content;
            this.confirmDialog = () => {
                ev.detail.confirm();
                this.closeDialog();
            };
            this.state.dialog.isDisplayed = true;
        }

        editText(ev) {
            this.dialogContent = undefined;
            this.state.dialog.title = ev.detail.title && ev.detail.title.toString();
            this.state.dialog.isEditText = true;
            this.state.inputContent = ev.detail.placeholder;
            this.confirmDialog = () => {
                this.closeDialog();
                ev.detail.callback(this.state.inputContent);
            };
            this.state.dialog.isDisplayed = true;
        }
        /**
         * Close the dialog.
         */
        closeDialog() {
            this.dialogContent = undefined;
            this.confirmDialog = () => true;
            this.state.dialog.title = undefined;
            this.state.dialog.isDisplayed = false;
            this.state.dialog.isEditText = false;
            this.spreadsheet.comp.focusGrid();
        }
        /**
         * Close the pivot dialog.
         */
        closePivotDialog() {
            this.state.pivotDialog.isDisplayed = false;
            this.spreadsheet.comp.focusGrid();
        }
        /**
         * Insert a value of the spreadsheet using the callbackfunction;
         */
        _onCellClicked(ev) {
            this.insertPivotValueCallback(ev.detail.formula);
            this.closePivotDialog();
        }
        /**
         * Retrieve the spreadsheet_data and the thumbnail associated to the
         * current spreadsheet
         */
        getSaveData() {
            const spreadsheet_data = this.spreadsheet.comp.model.exportData();
            return { spreadsheet_data, thumbnail: this.getThumbnail() };
        }
        getMissingValueDialogTitle() {
            const title = _t("Insert pivot cell");
            const pivotTitle = this.getPivotTitle();
            if (pivotTitle) {
                return `${title} - ${pivotTitle}`
            }
            return title;
        }

        getPivotTitle() {
            if (this.pivot) {
                const name = this.pivot.cache && this.pivot.cache.getModelLabel() || this.pivot.model;
                const id = this.pivot.id;
                return `${name} (#${id})`;
            }
            return "";
        }
        getThumbnail() {
            const dimensions = spreadsheet.SPREADSHEET_DIMENSIONS;
            const canvas = this.spreadsheet.comp.grid.comp.canvas.el;
            const canvasResizer = document.createElement("canvas");
            const size = this.props.thumbnailSize
            canvasResizer.width = size;
            canvasResizer.height = size;
            const canvasCtx = canvasResizer.getContext("2d");
            // use only 25 first rows in thumbnail
            const sourceSize = Math.min(25 * dimensions.DEFAULT_CELL_HEIGHT, canvas.width, canvas.height);
            canvasCtx.drawImage(canvas, dimensions.HEADER_WIDTH - 1, dimensions.HEADER_HEIGHT - 1, sourceSize, sourceSize, 0, 0, size, size);
            return canvasResizer.toDataURL().replace("data:image/png;base64,", "");
        }
        /**
         * Make a copy of the current document
         */
        makeCopy() {
            const { spreadsheet_data, thumbnail } = this.getSaveData();
            this.saveData();
            this.trigger("make_copy", { spreadsheet_data, thumbnail, id: this.res_id });
        }
        /**
         * Create a new spreadsheet
         */
        newSpreadsheet() {
            this.saveData();
            this.trigger("new_spreadsheet");
        }

        /**
         * @private
         * @returns {Promise}
         */
        async _saveAsTemplate() {
            const data = this.spreadsheet.comp.model.exportData();
            const { pivots } = data;
            await convertPivotFormulas(
                this.env.services.rpc,
                getCells(data,  pivotFormulaRegex),
                absoluteToRelative,
                pivots
            );
            const name = this.props.name;
            this.trigger("do-action", {
                action: "documents_spreadsheet.save_spreadsheet_template_action",
                options: {
                    additional_context: {
                        default_template_name: `${name} - Template`,
                        default_data: jsonToBase64(data),
                        default_thumbnail: this.getThumbnail(),
                    },
                },
            });
        }
        /**
         * Open a dialog to display a message to the user.
         *
         * @param {CustomEvent} ev
         * @param {string} ev.detail.content Content to display
         */
        notifyUser(ev) {
            this.dialogContent = ev.detail.content;
            this.confirmDialog = this.closeDialog;
            this.state.dialog.isDisplayed = true;
        }

        openPivotDialog(ev){
            this.pivot = this.spreadsheet.comp.model.getters.getPivot(ev.pivotId);
            this.insertPivotValueCallback = ev.insertPivotValueCallback;
            this.state.pivotDialog.isDisplayed = true;
        }
        /**
         * Saves the spreadsheet data in the database
         *
         */
        saveData() {
            const { spreadsheet_data, thumbnail } = this.getSaveData();
            this.trigger("spreadsheet_saved", {
                data: spreadsheet_data,
                thumbnail,
            });
        }
    }

    SpreadsheetComponent.template = "documents_spreadsheet.SpreadsheetComponent";
    SpreadsheetComponent.components = { Spreadsheet, Dialog, PivotDialog };
    Spreadsheet._t = _t;

    return SpreadsheetComponent;
});
