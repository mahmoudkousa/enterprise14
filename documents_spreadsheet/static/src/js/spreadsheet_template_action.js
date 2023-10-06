odoo.define("documents_spreadsheet.SpreadsheetTemplateAction", function (require) {
    "use strict";

    const AbstractAction = require("documents_spreadsheet.SpreadsheetAbstractAction");
    const { base64ToJson, jsonToBase64 } = require("documents_spreadsheet.pivot_utils");
    const core = require("web.core");

    const { _lt, _t } = core;

    const SpreadsheetAction = AbstractAction.extend({
        notificationMessage: _lt("New spreadsheet template created"),
        thumbnailSize: 750,

        async _fetchSpreadsheetData(id) {
            const [record] = await this._rpc({
                model: "spreadsheet.template",
                method: "search_read",
                fields: ["name", "data"],
                domain: [["id", "=", id]],
                limit: 1,
            });
            return record;
        },

        async _fetchSpreadsheetWriteAccess(id) {
            return await this._rpc({
                model: "spreadsheet.template",
                method: "check_spreadsheet_access",
                args: [id, "write"],
                kwargs: {
                    raise_exception: false,
                }
            });
        },

        _updateData(record) {
            this._super(record);
            this.spreadsheetData = base64ToJson(record.data);
        },

        /**
         * Create a copy of the given spreadsheet and display it
         */
        async _makeCopy({ id, spreadsheet_data, thumbnail }) {
            return this._rpc({
                model: "spreadsheet.template",
                method: "copy",
                args: [
                    id,
                    {
                        data: jsonToBase64(spreadsheet_data),
                        thumbnail,
                    },
                ],
            });
        },
        /**
         * Create a new sheet
         */
        _createNewSpreadsheet() {
            return this._rpc({
                model: "spreadsheet.template",
                method: "create",
                args: [
                    {
                        name: _t("Untitled spreadsheet template"),
                        data: btoa("{}"),
                    },
                ],
            });
        },
        /**
         * Saves the spreadsheet name change.
         * @private
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _saveName(name) {
            return this._rpc({
                model: "spreadsheet.template",
                method: "write",
                args: [
                    [this.res_id],
                    {
                        name,
                    },
                ],
            });
        },
        _saveSpreadsheet(data, thumbnail) {
            return this._rpc({
                model: "spreadsheet.template",
                method: "write",
                args: [[this.res_id], { data: jsonToBase64(data), thumbnail }],
            });
        },
    });

    core.action_registry.add("action_open_template", SpreadsheetAction);

    return SpreadsheetAction;
});
