odoo.define("documents_spreadsheet.SpreadsheetAbstractAction", function (require) {
    "use strict";

    const AbstractAction = require("web.AbstractAction");
    const SpreadsheetComponent = require("documents_spreadsheet.SpreadsheetComponent");
    const SpreadsheetControlPanel = require("documents_spreadsheet.ControlPanel");
    const core = require("web.core");

    const _t = core._t;

    const { ComponentWrapper } = require("web.OwlCompatibility");
    const SpreadsheetAbstractAction = AbstractAction.extend({
        config: Object.assign({}, AbstractAction.prototype.config, {
            ControlPanel: SpreadsheetControlPanel,
        }),
        jsLibs: [
            '/web/static/lib/Chart/Chart.js',
        ],
        contentTemplate: "documents_spreadsheet.SpreadsheetAction",
        events: {},
        custom_events: {
            spreadsheet_name_changed: "_onSpreadSheetNameChanged",
            make_copy: "_onMakeCopy",
            new_spreadsheet: "_onNewSpreadsheet",
            spreadsheet_saved: "_onSpreadsheetSaved",
        },
        hasControlPanel: true,
        thumbnailSize: 750,

        /**
         * @override
         */
        init(parent, action) {
            this._super.apply(this, arguments);
            this.tag = action.tag;
            this.res_id = action.params.active_id;
            this.showFormulas = action.params.showFormulas || false;
            this.spreadsheetComponent = false;
            this.spreadsheetData = false;
            this.spreadsheetName = false;
            this.access = {};
        },

        /**
         * @override
         */
        willStart() {
            const promises = [];
            promises.push(this._super.apply(this, arguments));
            promises.push(this._loadData());
            return Promise.all(promises);
        },

        /**
         * @override
         */
        async start() {
            this._setTitle(this.spreadsheetName);
            if (!this.spreadsheetData) {
                return this.do_action({
                    type: "ir.actions.client",
                    tag: "home",
                });
            }
            await this._super.apply(this, arguments);
            const container = this.el.getElementsByClassName("o_spreadsheet_action")[0];
            this.spreadsheetComponent = new ComponentWrapper(this, SpreadsheetComponent, {
                data: this.spreadsheetData,
                res_id: this.res_id,
                name: this.spreadsheetName,
                showFormulas: this.showFormulas,
                thumbnailSize: this.thumbnailSize,
            });
            await this.spreadsheetComponent.mount(container);
            this.spreadsheetComponent._addListener("make_copy");
            this.spreadsheetComponent._addListener("new_spreadsheet");
        },

        destroy() {
            if (this.spreadsheetComponent) {
                this.spreadsheetComponent.destroy();
            }
            this._super.apply(this, arguments);
        },

        /**
         * @override
         */
        getTitle() {
            // Return "Spreadsheet" as the action name while the spreadsheet name is not loaded or
            // the actual spreadsheet name once loaded.
            return this.spreadsheetName === false ? _t("Spreadsheet") : this.spreadsheetName;
        },

        canBeRemoved() {
            const { spreadsheet_data, thumbnail } = this.spreadsheetComponent.componentRef.comp.getSaveData();
            return this.access.write ? this._saveSpreadsheet(spreadsheet_data, thumbnail) : Promise.resolve();
        },

        async _loadData() {
            if (this.res_id === undefined) {
                return;
            }
            const record = await this._fetchSpreadsheetData(this.res_id);
            if (record) {
                this._updateData(record);
            }
            if (this.access.write === undefined) {
                this.access.write = await this._fetchSpreadsheetWriteAccess(this.res_id);
                if (!this.access.write) {
                    this.displayNotification({
                        type: "warning",
                        message: _t("You do not have the rights to edit this spreadsheet. All the changes you will make will be lost at reload."),
                        sticky: true,
                    });
                }
            }
        },

        _updateData({ name }) {
            if (name !== undefined) {
                this.spreadsheetName = name;
            }
        },

        /**
         * Create a copy of the given spreadsheet and display it
         */
        async _onMakeCopy(ev) {
            const id = await this._makeCopy(ev.data);
            this._openSpreadsheet(id);
        },

        /**
         * Create a new sheet and display it
         */
        async _onNewSpreadsheet() {
            const id = await this._createNewSpreadsheet();
            this._openSpreadsheet(id);
        },

        /**
         * Saves the spreadsheet name change.
         * @private
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _onSpreadSheetNameChanged(ev) {
            const { name } = ev.data;
            this.spreadsheetName = name;
            this.spreadsheetComponent.update({ name });
            return this._saveName(name);
        },

        _onSpreadsheetSaved(ev) {
            const { data, thumbnail } = ev.data;
            this._saveSpreadsheet(data, thumbnail);
        },

        /**
         * Open a spreadsheet
         */
        _openSpreadsheet(active_id) {
            this.displayNotification({
                type: "info",
                message: this.notificationMessage,
                sticky: false,
            });
            this.do_action(
                {
                    type: "ir.actions.client",
                    tag: this.tag,
                    params: { active_id },
                },
                { clear_breadcrumbs: true }
            );
        },

        async _createNewSpreadsheet() {
            /** ... */
        },

        async _makeCopy(data) {
            /** ... */
        },

        async _saveName(name) {
            /** ... */
        },

        async _fetchSpreadsheetData(id) {
            /** ... */
        },

        async _fetchSpreadsheetWriteAccess(id) {
            /** ... */
        },

        /**
         * @param {string} data stringifyed spreadsheet data
         * @param {string} thumbnail
         */
        async _saveSpreadsheet(data, thumbnail) {
            /** ... */
        },
    });

    return SpreadsheetAbstractAction;
});
