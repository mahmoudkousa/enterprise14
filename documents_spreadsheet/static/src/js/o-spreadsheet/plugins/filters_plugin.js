odoo.define("documents_spreadsheet.FiltersPlugin", function (require) {
    "use strict";

    /**
     * @typedef {Object} GlobalFilter
     * @property {string} id
     * @property {string} label
     * @property {string} type "text" | "date" | "relation"
     * @property {string|undefined} rangeType "year" | "month" | "quarter"
     * @property {Object} fields
     * @property {string|Array<string>|Object} defaultValue Default Value
     * @property {string|Array<string>|Object} [value] Current Value
     * @property {number} [modelID] ID of the related model
     * @property {string} [modelName] Name of the related model
     */

    const core = require("web.core");
    const Domain = require("web.Domain");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const { constructDateDomain, yearSelected, getPeriodOptions } = require("web.searchUtils");
    const CancelledReason = require("documents_spreadsheet.CancelledReason");
    const pyUtils = require("web.py_utils");

    const _t = core._t;

    class FiltersPlugin extends spreadsheet.BasePlugin {
        constructor(workbook, getters, history, dispatch, config) {
            super(...arguments);
            this.rpc = config.evalContext.env ? config.evalContext.env.services.rpc : undefined;
            this.globalFilters = [];

            /**
             * Cache record display names for relation filters.
             * For each filter, contains a promise resolving to
             * the list of display names.
             */
            this.recordsDisplayName = {};
        }

        /**
         * Check if the given command can be dispatched
         *
         * @param {Object} cmd Command
         */
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "START":
                    this._setUpFilters();
                    break;
                case "EDIT_PIVOT_FILTER":
                    if (!this.getGlobalFilter(cmd.id)) {
                        return { status: "CANCELLED", reason: CancelledReason.FilterNotFound };
                    } else if (this._isDuplicatedLabel(cmd.id, cmd.filter.label)) {
                        return {
                            status: "CANCELLED",
                            reason: CancelledReason.DuplicatedFilterLabel,
                        };
                    }
                    return this._checkTypeValueCombination(cmd.filter.type, cmd.filter.defaultValue);                
                case "SET_PIVOT_FILTER_VALUE":
                    const filter = this.getGlobalFilter(cmd.id);
                    if (!filter) {
                        return { status: "CANCELLED", reason: CancelledReason.FilterNotFound };
                    }
                    return this._checkTypeValueCombination(filter.type, cmd.value);
                case "REMOVE_PIVOT_FILTER":
                    if (!this.getGlobalFilter(cmd.id)) {
                        return { status: "CANCELLED", reason: CancelledReason.FilterNotFound };
                    }
                    break;
                case "ADD_PIVOT_FILTER":
                    if (this._isDuplicatedLabel(cmd.id, cmd.filter.label)) {
                        return {
                            status: "CANCELLED",
                            reason: CancelledReason.DuplicatedFilterLabel,
                        };
                    }
                    return this._checkTypeValueCombination(cmd.filter.type, cmd.filter.defaultValue);
            }
            return { status: "SUCCESS" };
        }

        /**
         * Handle a spreadsheet command
         * @param {Object} cmd Command
         */
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_PIVOT_FILTER":
                    this.history.updateLocalState(
                        ["recordsDisplayName", cmd.filter.id],
                        cmd.filter.defaultValueDisplayNames
                    );
                    this._addGlobalFilter(cmd.filter);
                    break;
                case "EDIT_PIVOT_FILTER":
                    this.history.updateLocalState(
                        ["recordsDisplayName", cmd.filter.id],
                        cmd.filter.defaultValueDisplayNames
                    );
                    this._editGlobalFilter(cmd.id, cmd.filter);
                    break;
                case "SET_PIVOT_FILTER_VALUE":
                    this.history.updateLocalState(["recordsDisplayName", cmd.id], cmd.displayNames);
                    this._setGlobalFilterValue(cmd.id, cmd.value);
                    break;
                case "REMOVE_PIVOT_FILTER":
                    this._removeGlobalFilter(cmd.id);
                    break;
                case "UNDO":
                case "REDO":
                    this._updatePivotsDomain();
                    break;
            }
        }

        // ---------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------

        /**
         * Retrive the global filter with the given id
         *
         * @param {number} id
         *
         * @returns {Object} Global filter
         */
        getGlobalFilter(id) {
            return this.globalFilters.find((x) => x.id === id);
        }
        /**
         * Retrieve the global filters
         *
         * @returns {Array<Object>} Array of Global filters
         */
        getGlobalFilters() {
            return this.globalFilters;
        }

        /**
         * @returns {number}
         */
        getActiveFilterCount() {
            return this.globalFilters.filter((filter) => {
                switch (filter.type) {
                    case "text":
                        return filter.value;
                    case "date":
                        return filter.value && (filter.value.year || filter.value.period);
                    case "relation":
                        return filter.value && filter.value.length;
                }
            }).length;
        }

        async getFilterDisplayValue(filterName) {
            const filter = this.globalFilters.find((filter) => filter.label === filterName);
            if (!filter) {
                throw new Error(_.str.sprintf(_t(`Filter "%s" not found`), filterName));
            };
            switch (filter.type) {
                case "text":
                    return filter.value || "";
                case "date":
                    return getPeriodOptions(moment())
                        .filter(
                            ({ id }) =>
                                filter.value &&
                                [filter.value.year, filter.value.period].includes(id)
                        )
                        .map((period) => period.description)
                        .join(" ");
                case "relation":
                    if (!filter.value || !this.rpc) return "";
                    if (!this.recordsDisplayName[filter.id]) {
                        // store the promise resolving to the list of display names
                        this.recordsDisplayName[filter.id] = this.rpc({
                            model: filter.modelName,
                            method: "name_get",
                            args: [filter.value],
                        }).then((result) => result.map(([id, name]) => name));
                    }
                    const names = await this.recordsDisplayName[filter.id];
                    return names.join(", ");
            }
        }

        // ---------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------

        /**
         * Add a global filter
         *
         * @param {GlobalFilter} filter
         */
        _addGlobalFilter(filter) {
            this.history.updateLocalState(
                ["globalFilters"],
                [
                    ...this.globalFilters,
                    {
                        id: filter.id,
                        label: filter.label,
                        type: filter.type,
                        rangeType: filter.rangeType,
                        fields: filter.fields,
                        value: filter.defaultValue,
                        defaultValue: filter.defaultValue,
                        modelName: filter.modelName,
                    },
                ]
            );
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS");
        }
        /**
         * Set the current value of a global filter
         *
         * @param {number} id Id of the filter
         * @param {string|Array<string>} value Current value to set
         */
        _setGlobalFilterValue(id, value) {
            const globalFilter = this.globalFilters.find((filter) => filter.id === id);
            globalFilter.value = value;
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS");
        }
        /**
         * Remove a global filter
         *
         * @param {number} id Id of the filter to remove
         */
        _removeGlobalFilter(id) {
            this.history.updateLocalState(
              ["globalFilters"],
              this.globalFilters.filter((filter) => filter.id !== id)
            );
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS");
        }
        /**
         * Edit a global filter
         *
         * @param {number} id Id of the filter to update
         * @param {GlobalFilter} newFilter
         */
        _editGlobalFilter(id, newFilter) {
            const currentLabel = this.getGlobalFilter(id).label;
            const globalFilters = this.globalFilters.map((filter) =>
                filter.id !== id
                    ? filter
                    : {
                          id: filter.id,
                          value: newFilter.defaultValue,
                          label: newFilter.label,
                          type: newFilter.type,
                          rangeType: newFilter.rangeType,
                          fields: newFilter.fields,
                          defaultValue: newFilter.defaultValue,
                          value: newFilter.defaultValue,
                          modelName: newFilter.modelName,
                      }
            );
            this.history.updateLocalState(
              ["globalFilters"],
              globalFilters
            );
            const newLabel = this.getGlobalFilter(id).label;
            if (currentLabel !== newLabel) {
                this._updateFilterLabelInFormulas(currentLabel, newLabel);
            }
            this._updatePivotsDomain();
            this.dispatch("EVALUATE_CELLS");
        }

        // ---------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------

        /**
         * Import the pivots
         *
         * @param {Object} data
         */
        import(data) {
            if (data.globalFilters) {
                this.globalFilters = data.globalFilters;
                for (let globalFilter of this.globalFilters) {
                    globalFilter.value = globalFilter.defaultValue;
                }
            }
        }
        /**
         * Export the pivots
         *
         * @param {Object} data
         */
        export(data) {
            data.globalFilters = this.globalFilters.map((filter) => Object.assign({}, filter));
            for (let globalFilter of data.globalFilters) {
                globalFilter.value = undefined;
            }
        }

        // ---------------------------------------------------------------------
        // Global filters
        // ---------------------------------------------------------------------

        _setUpFilters() {
            if (this.getters.getPivots().length) {
                this._updatePivotsDomain({ refresh: true });
            }
        }

        /**
         * Update all FILTER.VALUE formulas to reference a filter
         * by its new label.
         * @param {string} currentLabel
         * @param {string} newLabel
         */
        _updateFilterLabelInFormulas(currentLabel, newLabel) {
            const sheets = this.getters.getSheets();
            currentLabel = currentLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            for (let sheet of sheets) {
                for (let cell of Object.values(sheet.cells)) {
                    if (cell.type === "formula") {
                        const newContent = cell.content.replace(
                            new RegExp(`FILTER\\.VALUE\\(\\s*"${currentLabel}"\\s*\\)`, "g"),
                            `FILTER.VALUE("${newLabel}")`
                        );
                        if (newContent !== cell.content) {
                            this.dispatch("UPDATE_CELL", {
                                sheet: sheet.id,
                                content: newContent,
                                col: cell.col,
                                row: cell.row,
                            });
                        }
                    }
                }
            }
        }

        /**
         * Return true if the label is duplicated
         * @param {string | undefined} filterId
         * @param {string} label
         * @returns {boolean}
         */
        _isDuplicatedLabel(filterId, label) {
            return (
                this.globalFilters.findIndex(
                    (filter) => (!filterId || filter.id !== filterId) && filter.label === label
                ) > -1
            );
        }

        _checkTypeValueCombination(type, value){
            if (value !== undefined){
                switch (type){
                    case "text":
                        if (typeof value !== "string"){
                            return {
                                status: "CANCELLED",
                                reason : CancelledReason.InvalidValueTypeCombination,
                            }
                        }
                        break;
                    case "date":
                        if (typeof value !== "object" || Array.isArray(value)){ // not a date
                            return {
                                status: "CANCELLED",
                                reason : CancelledReason.InvalidValueTypeCombination,
                            }
                        }
                        break;
                    case "relation":
                        if (!Array.isArray(value)){
                            return {
                                status: "CANCELLED",
                                reason : CancelledReason.InvalidValueTypeCombination,
                            }
                        }
                        break;
                }
            }
            return { status: "SUCCESS" }
        }

        /**
         * Update the domain of all the pivots by applying global filters to
         * the initial domain of the pivot.
         */
        _updatePivotsDomain({ refresh = true } = {}) {
            for (let pivot of this.getters.getPivots()) {
                let domain = "[]";
                for (let filter of this.globalFilters) {
                    if (!(pivot.id in filter.fields)) {
                        continue;
                    }
                    if (filter.type === "date") {
                        const values = filter.value && Object.values(filter.value).filter(Boolean);
                        if (!values || values.length === 0) {
                            continue;
                        }
                        if (!yearSelected(values)) {
                            values.push("this_year");
                        }
                        const field = filter.fields[pivot.id].field;
                        const type = filter.fields[pivot.id].type;
                        const dateFilterRange = constructDateDomain(moment(), field, type, values);
                        const dateDomain = Domain.prototype.arrayToString(
                            pyUtils.eval("domain", dateFilterRange.domain, {})
                        );
                        domain = pyUtils.assembleDomains([domain, dateDomain], "AND");
                    }
                    if (filter.type === "text") {
                        const value = filter.value;
                        if (!value) {
                            continue;
                        }
                        const field = filter.fields[pivot.id].field;
                        const textDomain = Domain.prototype.arrayToString([
                            [field, "ilike", value],
                        ]);
                        domain = pyUtils.assembleDomains([domain, textDomain], "AND");
                    }
                    if (filter.type === "relation") {
                        const values = filter.value;
                        if (!values || values.length === 0) {
                            continue;
                        }
                        const field = filter.fields[pivot.id].field;
                        const textDomain = Domain.prototype.arrayToString([[field, "in", values]]);
                        domain = pyUtils.assembleDomains([domain, textDomain], "AND");
                    }
                }
                this.dispatch("ADD_PIVOT_DOMAIN", { id: pivot.id, domain, refresh });
            }
        }
    }

    FiltersPlugin.modes = ["normal", "headless", "readonly"];
    FiltersPlugin.getters = [
        "getGlobalFilter",
        "getGlobalFilters",
        "getFilterDisplayValue",
        "getActiveFilterCount",
    ];

    return FiltersPlugin;
});
