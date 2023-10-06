odoo.define("documents_spreadsheet.PivotDialog", function (require) {
    "use strict";
    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const PivotDialogTable = require("documents_spreadsheet.PivotDialogTable");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const functionRegistry = spreadsheet.registries.functionRegistry;
    const _t = core._t;
    const { useState } = owl.hooks;
    const formatDecimal = spreadsheet.helpers.formatDecimal;
    const {fetchCache} = require("documents_spreadsheet.pivot_utils");

    /**
     * @typedef {Object} PivotDialogColumn
     * @property {string} formula Pivot formula
     * @property {string} value Pivot value of the formula
     * @property {number} span Size of col-span
     * @property {number} position Position of the column
     * @property {boolean} isMissing True if the value is missing from the sheet
     * @property {string} style Style of the column
     */

    /**
     * @typedef {Object} PivotDialogRow
     * @property {Array<string>} args Args of the pivot formula
     * @property {string} formula Pivot formula
     * @property {string} value Pivot value of the formula
     * @property {boolean} isMissing True if the value is missing from the sheet
     * @property {string} style Style of the column
     */

    /**
     * @typedef {Object} PivotDialogValue
     * @property {Object} args
     * @property {string} args.formula Pivot formula
     * @property {string} args.value Pivot value of the formula
     * @property {boolean} isMissing True if the value is missing from the sheet
     */

     class PivotDialog extends owl.Component {
        constructor() {
            super(...arguments);
            this.state = useState({
                showMissingValuesOnly: false,
            });
        }

        async willStart() {
            this.data = {
                columns: this._buildColHeaders(),
                rows: this._buildRowHeaders(),
                values: this._buildValues(),
            };
        }

        get pivot() {
            return this.props.pivot;
        }

        // ---------------------------------------------------------------------
        // Missing values building
        // ---------------------------------------------------------------------

        /**
         * Retrieve the data to display in the Pivot Table
         * In the case when showMissingValuesOnly is false, the returned value
         * is the complete data
         * In the case when showMissingValuesOnly is true, the returned value is
         * the data which contains only missing values in the rows and cols. In
         * the rows, we also return the parent rows of rows which contains missing
         * values, to give context to the user.
         *
         * @returns {Object} { columns, rows, values }
         */
        getTableData() {
            if (!this.state.showMissingValuesOnly) {
                return this.data;
            }
            const colIndexes = this._getColumnsIndexes();
            const rowIndexes = this._getRowsIndexes();
            const columns = this._buildColumnsMissing(colIndexes);
            const rows = this._buildRowsMissing(rowIndexes);
            const values = this._buildValuesMissing(colIndexes, rowIndexes);
            return { columns, rows, values };
        }
        /**
         * Retrieve the parents of the given row
         * ex:
         *  Australia
         *    January
         *    February
         * The parent of "January" is "Australia"
         *
         * @private
         * @param {number} index Index of the row
         * @returns {Array<number>}
         */
        _addRecursiveRow(index) {
            const row = this.pivot.cache.getRowValues(index).slice();
            if (row.length <= 1) {
                return [index];
            }
            row.pop();
            const parentRowIndex = this.pivot.cache.getRowIndex(row);
            return [index].concat(this._addRecursiveRow(parentRowIndex));
        }
        /**
         * Create the columns to be used, based on the indexes of the columns in
         * which a missing value is present
         *
         * @private
         * @param {Array<number>} indexes Indexes of columns with a missing value
         * @returns {Array<Array<PivotDialogColumn>>}
         */
        _buildColumnsMissing(indexes) {
            // columnsMap explode the columns in an array of array of the same
            // size with the index of each columns, repeated 'span' times.
            // ex:
            //  | A     | B |
            //  | 1 | 2 | 3 |
            // => [
            //      [0, 0, 1]
            //      [0, 1, 2]
            //    ]
            const columnsMap = [];
            for (let column of this.data.columns) {
                const columnMap = [];
                for (let index in column) {
                    for (let i = 0; i < column[index].span; i++) {
                        columnMap.push(index);
                    }
                }
                columnsMap.push(columnMap);
            }
            // Remove the columns that are not present in indexes
            for (let i = columnsMap[columnsMap.length - 1].length; i >= 0; i--) {
                if (!indexes.includes(i)) {
                    for (let columnMap of columnsMap) {
                        columnMap.splice(i, 1);
                    }
                }
            }
            // Build the columns
            const columns = [];
            for (let mapIndex in columnsMap) {
                const column = [];
                let index = undefined;
                let span = 1;
                for (let i = 0; i < columnsMap[mapIndex].length; i++) {
                    if (index !== columnsMap[mapIndex][i]) {
                        if (index) {
                            column.push(Object.assign({}, this.data.columns[mapIndex][index], { span }));
                        }
                        index = columnsMap[mapIndex][i];
                        span = 1;
                    } else {
                        span++;
                    }
                }
                if (index) {
                    column.push(Object.assign({}, this.data.columns[mapIndex][index], { span }));
                }
                columns.push(column);
            }
            return columns;
        }
        /**
         * Create the rows to be used, based on the indexes of the rows in
         * which a missing value is present.
         *
         * @private
         * @param {Array<number>} indexes Indexes of rows with a missing value
         * @returns {Array<PivotDialogRow>}
         */
        _buildRowsMissing(indexes) {
            return indexes.map((index) => this.data.rows[index]);
        }
        /**
         * Create the value to be used, based on the indexes of the columns and
         * rows in which a missing value is present.
         *
         * @private
         * @param {Array<number>} colIndexes Indexes of columns with a missing value
         * @param {Array<number>} rowIndexes Indexes of rows with a missing value
         * @returns {Array<PivotDialogValue}
         */
        _buildValuesMissing(colIndexes, rowIndexes) {
            const values = colIndexes.map(() => []);
            for (let row of rowIndexes) {
                for (let col in colIndexes) {
                    values[col].push(this.data.values[colIndexes[col]][row]);
                }
            }
            return values;
        }
        /**
         * Get the indexes of the columns in which a missing value is present
         * @private
         * @returns {Array<number>}
         */
        _getColumnsIndexes() {
            const indexes = new Set();
            for (let i = 0; i < this.data.columns.length; i++) {
                const exploded = [];
                for (let y = 0; y < this.data.columns[i].length; y++) {
                    for (let x = 0; x < this.data.columns[i][y].span; x++) {
                        exploded.push(this.data.columns[i][y]);
                    }
                }
                for (let y = 0; y < exploded.length; y++) {
                    if (exploded[y].isMissing) {
                        indexes.add(y);
                    }
                }
            }
            for (let i = 0; i < this.data.columns[this.data.columns.length - 1].length; i++) {
                const values = this.data.values[i];
                if (values.find((x) => x.isMissing)) {
                    indexes.add(i);
                }
            }
            return Array.from(indexes).sort((a, b) => a - b);
        }
        /**
         * Get the indexes of the rows in which a missing value is present
         * @private
         * @returns {Array<number>}
         */
        _getRowsIndexes() {
            const rowIndexes = new Set();
            for (let i = 0; i < this.data.rows.length; i++) {
                if (this.data.rows[i].isMissing) {
                    rowIndexes.add(i);
                }
                for (let col of this.data.values) {
                    if (col[i].isMissing) {
                        this._addRecursiveRow(i).forEach((x) =>
                            rowIndexes.add(x)
                        );
                    }
                }
            }
            return Array.from(rowIndexes).sort((a, b) => a - b);
        }

        // ---------------------------------------------------------------------
        // Data table creation
        // ---------------------------------------------------------------------

        /**
         * Create a cell information from the args of the pivot formula
         *
         * @private
         * @param {Array<string>} args Args of the pivot formula
         * @returns {Object} { value, formula }
         */
        _buildCell(args) {
            const formula = `=PIVOT("${args.join('","')}")`;
            const measure = args[1];
            const operator = this.pivot.measures.filter(
                (m) => m.field === measure
            )[0].operator;
            args.splice(0, 2);
            const domain = args.map((x) => x.toString());
            const value = this.pivot.cache.getMeasureValue(
                functionRegistry.mapping,
                measure,
                operator,
                domain
            );
            return {value: this._formatValue(value), formula };
        }
        /**
         * Create the columns headers of the Pivot
         *
         * @private
         * @returns {Array<Array<PivotDialogColumn>>}
         */
        _buildColHeaders() {
            const pivot = this.pivot;
            const levels = pivot.cache.getColGroupByLevels();
            const headers = [];

            let length =
                pivot.cache.getTopHeaderCount() - pivot.measures.length;
            if (length === 0) {
                length = pivot.cache.getTopHeaderCount();
            }
            for (let i = 0; i < length; i++) {
                for (let level = 0; level <= levels; level++) {
                    const pivotArgs = [];
                    const values = pivot.cache.getColGroupHierarchy(i, level);
                    for (const index in values) {
                        pivotArgs.push(pivot.cache.getColLevelIdentifier(index));
                        pivotArgs.push(values[index]);
                    }
                    const isMissing = !pivot.cache.isUsedHeader(pivotArgs);
                    pivotArgs.unshift(pivot.id);
                    if (headers[level]) {
                        headers[level].push({ args: pivotArgs, isMissing });
                    } else {
                        headers[level] = [{ args: pivotArgs, isMissing }];
                    }
                }
            }
            for (let i = length; i < pivot.cache.getTopHeaderCount(); i++) {
                let isMissing = !pivot.cache.isUsedHeader([]);
                headers[headers.length - 2].push({ args: [pivot.id], isMissing });
                const args = ["measure", pivot.cache.getColGroupHierarchy(i, 1)[0]];
                isMissing = !pivot.cache.isUsedHeader(args);
                headers[headers.length - 1].push({ args: [pivot.id, ...args], isMissing });
            }
            return headers.map((row) => {
                const reducedRow = row.reduce((acc, curr) => {
                    const val = curr.args.join('","');
                    if (acc[val] === undefined) {
                        acc[val] = {
                            count: 0,
                            position: Object.keys(acc).length,
                            isMissing: curr.isMissing,
                        };
                    }
                    acc[val].count++;
                    return acc;
                }, {});

                return Object.entries(reducedRow)
                    .map(([val, info]) => {
                        const style = row === headers[headers.length - 1] && !info.isMissing &&  "color: #756f6f;"
                        return {
                            formula: `=PIVOT.HEADER("${val}")`,
                            value: this._getLabel(val),
                            span: info.count,
                            position: info.position,
                            isMissing: info.isMissing,
                            style,
                        };
                    })
                    .sort((a, b) => (a.position > b.position ? 1 : -1));
            });
        }
        /**
         * Create the row of the pivot table
         *
         * @private
         * @returns {Array<PivotDialogRow>}
         */
        _buildRowHeaders() {
            const pivot = this.pivot;
            const rowCount = pivot.cache.getRowCount();
            const headers = [];
            for (let index = 0; index < rowCount; index++) {
                const pivotArgs = [];
                const current = pivot.cache.getRowValues(index);
                for (let i in current) {
                    pivotArgs.push(pivot.rowGroupBys[i]);
                    pivotArgs.push(current[i]);
                }
                const isMissing = !pivot.cache.isUsedHeader(pivotArgs);
                pivotArgs.unshift(pivot.id);
                headers.push({ args: pivotArgs, isMissing });
            }
            return headers.map(({ args, isMissing }) => {
                const argsString = args.join('","');
                const style = this._getStyle(args);
                return {
                    args,
                    formula: `=PIVOT.HEADER("${argsString}")`,
                    value: this._getLabel(argsString),
                    style,
                    isMissing,
                };
            });
        }
        /**
         * Build the values of the pivot table
         *
         * @private
         * @returns {Array<PivotDialogValue>}
         */
        _buildValues() {
            const pivot = this.pivot;
            const length =
                pivot.cache.getTopHeaderCount() - pivot.measures.length;

            const values = [];
            for (let i = 0; i < length; i++) {
                const colElement = [
                    ...pivot.cache.getColumnValues(i),
                    pivot.cache.getMeasureName(i),
                ];
                const colValues = [];
                for (let rowElement of pivot.cache.getRows()) {
                    const pivotArgs = [];
                    for (let index in rowElement) {
                        pivotArgs.push(pivot.rowGroupBys[index]);
                        pivotArgs.push(rowElement[index]);
                    }
                    for (let index in colElement) {
                        const field = pivot.cache.getColLevelIdentifier(index);
                        if (field === "measure") {
                            pivotArgs.unshift(colElement[index]);
                        } else {
                            pivotArgs.push(pivot.cache.getColLevelIdentifier(index));
                            pivotArgs.push(colElement[index]);
                        }
                    }
                    const isMissing = !pivot.cache.isUsedValue(pivotArgs);
                    pivotArgs.unshift(pivot.id);
                    colValues.push({ args: this._buildCell(pivotArgs), isMissing });
                }
                values.push(colValues);
            }
            for (let i = length; i < pivot.cache.getTopHeaderCount(); i++) {
                const colElement = [
                    ...pivot.cache.getColumnValues(i),
                    pivot.cache.getMeasureName(i),
                ];
                const colValues = [];
                for (let rowElement of pivot.cache.getRows()) {
                    const pivotArgs = [];
                    for (let index in rowElement) {
                        pivotArgs.push(pivot.rowGroupBys[index]);
                        pivotArgs.push(rowElement[index]);
                    }
                    pivotArgs.unshift(colElement[0]);
                    const isMissing = !pivot.cache.isUsedValue(pivotArgs);
                    pivotArgs.unshift(pivot.id);
                    colValues.push({ args: this._buildCell(pivotArgs), isMissing });
                }
                values.push(colValues);
            }
            return values;
        }
        /**
         * Format the given value with two decimals
         *
         * @private
         * @param {string} value Value to format
         * @returns {string}
         */
        _formatValue(value) {
            if (!value) {
                return "";
            }
            return formatDecimal(value, 2);
        }
        /**
         * Get the label of a pivot formula based on the args formula
         *
         * @private
         * @param {string} args Args of the pivot formula
         */
        _getLabel(args) {
            const pivot = this.pivot;
            let domain = args.split('","');
            domain.shift();
            const len = domain.length;
            if (len === 0) {
                return _t("Total");
            }
            const fieldName = domain[len - 2];
            const value = domain[len - 1];
            if (fieldName === "measure") {
                if (value === "__count") {
                    return _t("Count");
                }
                const field = pivot.cache.getField(value);
                return field ? field.string : value;
            } else {
                const field = pivot.cache.getField(fieldName.split(":")[0]);
                if (field && ["date", "datetime"].includes(field.type)) {
                    return pivotUtils.formatDate(fieldName, value);
                }
                return (
                    pivot.cache.getGroupLabel(fieldName, value) || _t("(Undefined)")
                );
            }
        }
        /**
         * Get the style to apply to a row.
         * It will compute the padding
         *
         * @private
         * @param {Array<string>} args Args of the pivot row
         * @returns {string}
         */
        _getStyle(args) {
            // The structure of args is [measure, gb, value, (gb, value)...]
            // So, with a size of 3, the padding is null
            const length = args.length - 3;
            if (!length) {
                return "";
            }
            return `padding-left: ${(length) * 10}px`;
        }
    }
    PivotDialog.template = "documents_spreadsheet.PivotDialog";
    PivotDialog.components = { PivotDialogTable };
    return PivotDialog;
});
