odoo.define("documents_spreadsheet.SpreadsheetSelectorDialog", function (require) {
    "use strict";

    const core = require("web.core");
    const Dialog = require("web.Dialog");
    const _t = core._t;

    const SpreadsheetSelectorDialog = Dialog.extend({
        template: "documents_spreadsheet.SpreadsheetSelectorDialog",
        /**
         * @constructor
         * @param {Widget} parent
         * @param {Object} spreadsheets
         */
        init: function (parent, spreadsheets) {
            this.spreadsheets = spreadsheets;

            const options = {
                title: _t("Select a spreadsheet to insert your pivot"),
                buttons: [
                    {
                        text: _t("Confirm"),
                        classes: "btn-primary",
                        click: this._onConfirm.bind(this),
                        close: true,
                    },
                    {
                        text: _t("Cancel"),
                        click: this._onCancel.bind(this),
                        close: true,
                    },
                ],
            };
            this._super(parent, options);
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         */
        _onConfirm: function () {
            const id = this.el.querySelector("select[name='spreadsheet']").value;
            let selectedSpreadsheet = false;
            if (id !== "") {
                selectedSpreadsheet = this.spreadsheets.find((s) => s.id === parseInt(id, 10));
            }
            this.trigger("confirm", selectedSpreadsheet);
        },
        /**
         * @private
         */
        _onCancel: function () {
            this.trigger("cancel");
        },
    });
    return SpreadsheetSelectorDialog;
});
