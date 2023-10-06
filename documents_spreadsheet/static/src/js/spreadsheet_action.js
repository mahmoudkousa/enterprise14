odoo.define("documents_spreadsheet.SpreadsheetAction", function (require) {
    "use strict";

    const AbstractAction = require("documents_spreadsheet.SpreadsheetAbstractAction");
    const core = require("web.core");

    const { _lt, _t } = core;

    const SpreadsheetAction = AbstractAction.extend({
        custom_events: Object.assign({}, AbstractAction.prototype.custom_events, {
            favorite_toggled: "_onSpreadSheetFavoriteToggled",
        }),
        notificationMessage: _lt("New spreadsheet created in Documents"),


        /**
         * @override
         */
        init() {
            this._super(...arguments);
            this.isFavorited = false;
        },

        /**
         * @override
         */
        start() {
            this.controlPanelProps.isFavorited = this.isFavorited;
            return this._super.apply(this, arguments);
        },

        async _fetchSpreadsheetData(id) {
            const [ record ] = await this._rpc({
                model: "documents.document",
                method: "search_read",
                fields: ["name", "raw", "is_favorited"],
                domain: [["id", "=", id]],
                limit: 1,
            });
            return record;
        },

        async _fetchSpreadsheetWriteAccess(id) {
            return await this._rpc({
                model: "documents.document",
                method: "check_spreadsheet_access",
                args: [id, "write"],
                kwargs: {
                    raise_exception: false,
                }
            });
        },

        _updateData(record) {
            this._super(record);
            this.isFavorited = record.is_favorited;
            this.spreadsheetData = JSON.parse(record.raw);
        },

        /**
         * Create a copy of the given spreadsheet and display it
         */
        _makeCopy({ spreadsheet_data, thumbnail }) {
            return this._rpc({
                model: "documents.document",
                method: "copy",
                args: [
                    this.res_id,
                    {
                        mimetype: "application/o-spreadsheet",
                        raw: JSON.stringify(spreadsheet_data),
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
                model: "documents.document",
                method: "create",
                args: [
                    {
                        name: _t("Untitled spreadsheet"),
                        mimetype: "application/o-spreadsheet",
                        raw: "{}",
                        handler: "spreadsheet",
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
                model: "documents.document",
                method: "write",
                args: [[this.res_id], {
                    name,
                }],
            });
        },
        /**
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _onSpreadSheetFavoriteToggled(ev) {
            return this._rpc({
                model: "documents.document",
                method: "toggle_favorited",
                args: [[this.res_id]],
            });
        },

        _saveSpreadsheet(data, thumbnail) {
            return this._rpc({
                model: "documents.document",
                method: "write",
                args: [[this.res_id], { raw: JSON.stringify(data), thumbnail }],
            });
        }
    });

    core.action_registry.add("action_open_spreadsheet", SpreadsheetAction);

    return SpreadsheetAction;
});
