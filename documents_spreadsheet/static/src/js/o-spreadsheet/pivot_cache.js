odoo.define("documents_spreadsheet.pivot_cache", function (require) {
    "use strict";

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const toString = spreadsheet.helpers.toString;
    const _t = require("web.core")._t;

    /**
     * Check if the array contains a given value using
     * a binary search.
     *
     * ** The array must be sorted! **
     *
     * @param {Array} arr
     * @param {any} value
     * @returns {boolean}
     */
    function binarySearch(arr, value) {
        let start = 0;
        let end = arr.length - 1;
        while (start <= end) {
            let mid = Math.floor((start + end) / 2);
            if (arr[mid] === value) {
                return true;
            } else if (arr[mid] < value) {
                start = mid + 1;
            } else {
                end = mid - 1;
            }
        }
        return false;
    }

    class PivotCache {
        constructor(data) {
            this._modelLabel = data.modelLabel;
            /**
             * Here is an example of a possible cols structure in the PivotCache.
             * Each element of the array describes a spreadsheet column. Each element
             * of a column is part of its group hierarchy which are used to build the headers.
             * e.g. a pivot grouped by partner then stage
             * [
             *      [   partner = 10 > stage = 2 > measure = "expected_revenue"
             *          ["10"],
             *          ["10", "2"],
             *          ["10", "2", "expected_revenue"],
             *      ],
             *      [   partner = 12 > stage = 2 > measure = "expected_revenue"
             *          ["12"],
             *          ["12", "2"],
             *          ["12", "2", "expected_revenue"],
             *      ],
             *      [   partner = 12 > stage = 3 > measure = "expected_revenue"
             *          ["12"],
             *          ["12", "3"],
             *          ["12", "3", "expected_revenue"],
             *      ],
             * ]
             **/
            this._cols = data.cols;

            /**
             * Pivot structure with grouped fields and measures
             * e.g. ["partner_id", "stage_id", "measure"]
             */
            this._colStructure = data.colStructure;

            /**
             * Model fields description as given by `fields_get`
             */
            this._fields = data.fields;

            /**
             * Link between a given group and measures falling in that group.
             * e.g. group with partner=10 contains the measure referenced by 4,
             * the group with no partner (=false) contains measures referenced by 1, 2 and 3.
             * {
             *      partner: [
             *          [10, [4]],
             *          [11, [0]],
             *          [12, [6, 5]],
             *          [false, [1, 2, 3]],
             *      ],
             *      "create_date:day" : [
             *          ["10/07/2020", [5]],
             *          ["15/07/2020", [6]],
             *          ["16/07/2020", [0, 3, 4]],
             *          ["17/05/2020", [1]],
             *          ["17/06/2020", [2]],
             *      ],
             *      stage: ...,
             *      country: ...,
             * }
             */
            this._orderedMeasureIds = data.orderedMeasureIds;
            /**
             * Same data as above but structured as objects for faster lookup.
             * {
             *      partner: {
             *          10: [4],
             *          11: [0],
             *          12: [1, 2, 3],
             *          false: [1, 2, 3],
             *      },
             *      "create_date:day" : {
             *          "10/07/2020": [5],
             *          "15/07/2020": [6],
             *          "16/07/2020": [0, 3, 4],
             *          "17/05/2020": [1],
             *          "17/06/2020": [2],
             *      },
             *      stage: ...,
             *      country: ...,
             * }
             */
            this._orderedMeasureIdsByValues = {}
            for (const [fieldName, values] of Object.entries(this._orderedMeasureIds)) {
                this._orderedMeasureIdsByValues[fieldName] = {};
                for (const [value, measureIds] of values) {
                    this._orderedMeasureIdsByValues[fieldName][value] = measureIds.sort((a, b) => a - b);
                }
            }
            /**
             * All possible values for each fields.
             * {
             *      partner: [10, 11, 12, false],
             *      "create_date:day": [
             *          "10/07/2020",
             *          "15/07/2020",
             *          "16/07/2020",
             *          "17/05/2020",
             *          "17/06/2020",
             *      ]
             *      stage: ...,
             *      country: ...,
             * }
             */
            this._fieldValues = {};
            for (let fieldName of Object.keys(this._orderedMeasureIds)) {
                this._fieldValues[fieldName] = this._orderedMeasureIds[fieldName].map(
                    ([fieldValue]) => fieldValue
                );
            }

            /**
             * Promises resolving to display name of many2one records.
             * Useless for non many2one fields.
             * {
             *      partner: {
             *          10: "Raoul",
             *          11: "Borat",
             *          12: "James",
             *      },
             *      "create_date:day" : {
             *          09/07/2020: "09/07/2020",
             *          10/07/2020: "10/07/2020",
             *          ...
             *      },
             *      stage: ...,
             *      country: ...,
             * }
             */
            this._labels = data.labels;

            /**
             * Each element of the array describes a spreadsheet row. Each row contains
             * the hierarchy of the group it belongs to.
             * [
             *      ["10"],                     //country = 10
             *      ["10", "16/07/2020"],       //country = 10 > create_date = "16/07/2020"
             *      ["13"],                     //country = 13
             *      ["13", "16/07/2020"],       //country = 13 > create_date = "16/07/2020"
             *      ["13", "17/07/2020"],       //country = 13 > create_date = "17/07/2020"
             *      ["173"],                    //country = 173
             *      ["173", "17/07/2020"],      //country = 173 > create_date = "17/07/2020"
             * ]
             **/
            this._rows = data.rows;

            /**
             * Measures references by the groupBys data structure.
             * They are referenced by their index.
             * [
             *      { expected_revenue: 4500, count: 1},
             *      { expected_revenue: 500, count: 1},
             *      { expected_revenue: 100, count: 2},
             *      { expected_revenue: 1000, count: 1},
             *      { expected_revenue: 25000, count: 5},
             *      { expected_revenue: 70000, count: 2},
             *      { expected_revenue: 25000, count: 5},
             * ]
             */
            this._values = data.values;

            /**
             * List of measure references. Cached for performance reasons. Rebuilding them
             * at each function evaluation requires too much GC work.
             */
            this._cacheKeys = [...data.values.keys()].sort((a, b) => a - b);

            /**
             * Contains the domain of the values used during the evaluation of the formula =Pivot(...)
             * Is used to know if a pivot cell is missing or not
             * */

            this._usedValueDomains = new Set();
            /**
             * Contains the domain of the headers used during the evaluation of the formula =Pivot.header(...)
             * Is used to know if a pivot cell is missing or not
             * */
            this._usedHeaderDomains = new Set();
        }

        getRows() {
            return this._rows;
        }

        /**
         * Return the total number of rows in the pivot, including
         * totals.
         * @returns {number}
         */
        getRowCount() {
            return this._rows.length;
        }

        /**
         * Return the name identifying a header level in
         * the columns hierarchy.
         * e.g. "stage_id" or "measure"
         * @param {number} level
         * @returns {string}
         */
        getColLevelIdentifier(level) {
            return this._colStructure[level];
        }

        /**
         * Return all field definitions
         * @returns {Object}
         */
        getFields() {
            return this._fields;
        }

        /**
         * Return a field description
         * @param {string} fieldName
         * @returns {Object}
         */
        getField(fieldName) {
            return this._fields[fieldName];
        }

        /**
         * Return all possible values in the pivot for a given field.
         * @param {string} fieldName
         * @returns {Array<string>}
         */
        getFieldValues(fieldName) {
            if (!(fieldName in this._fieldValues)) {
                throw new Error(`Cannot find any pivot values for field "${fieldName}"`);
            }
            return this._fieldValues[fieldName];
        }

        /**
         * Return the label of a group.
         * @param {string} groupBy e.g. create_date:month
         * @param {string} groupValue e.g. "05/2020"
         * @returns {Promise<string> | undefined}
         */
        getGroupLabel(groupBy, groupValue) {
            return this._labels[groupBy] && this._labels[groupBy][groupValue];
        }

        /**
         * Check if the label of group is loaded or being loaded.
         * @param {string} groupBy
         * @param {string} groupValue
         * @returns {boolean}
         */
        isGroupLabelLoaded(groupBy, groupValue) {
            return groupValue in this._labels[groupBy];
        }

        /**
         * Check if the pivot is only grouped by a date field.
         *
         * @param {Array<string>} groupBys e.g. ["stage_id", "create_date:month"]
         * @returns {Object} isDate: boolean and group: string
         */
        isGroupedByDate(groupBys) {
            if (groupBys.length !== 1) {
                return { isDate: false };
            }
            const [fieldName, group] = groupBys[0].split(":");
            const field = this._fields[fieldName];
            return {
                isDate: ["date", "datetime"].includes(field.type),
                group,
            };
        }

        /**
         * Return the measure name given the column index in the pivot.
         * @param {number} columnIndex
         * @returns {string}
         */
        getMeasureName(columnIndex) {
            const columnValues = this._cols[columnIndex];
            return columnValues[columnValues.length - 1].slice().pop();
        }

        /**
         * Return values of each group and subgroup of a given column.
         * e.g. ["17", "05/2020", "true"]
         * @param {number} columnIndex
         * @returns {Array<string>}
         */
        getColumnValues(columnIndex) {
            const columnValues = this._cols[columnIndex];
            const values = columnValues[columnValues.length - 1].slice();
            values.pop();
            return values;
        }

        /**
         * Returns the hierarchy from a subgroup to a topgroup.
         * e.g. ["17", "05/2020", "true", "expected_revenue"]
         * @param {number} topGroupIndex
         * @param {number} subgroupIndex
         */
        getColGroupHierarchy(topGroupIndex, subgroupIndex) {
            return this._cols[topGroupIndex][subgroupIndex];
        }

        /**
         * Return values of each group and subgroup of a given row.
         * e.g. ["17", "05/2020", true]
         * @param {number} columnIndex
         * @param {Array<string>}
         */
        getRowValues(rowIndex) {
            return this._rows[rowIndex];
        }

        /**
         * Return the number of levels of column groups.
         * @returns {number}
         */
        getColGroupByLevels() {
            return this._cols[0].length - 1;
        }

        /**
         * Return the number of top level headers, including
         * a header for the total.
         * @returns {number}
         */
        getTopHeaderCount() {
            return this._cols.length;
        }

        /**
         * From lower level column values, find the top group index.
         * @param {Array<string>} groupeValues e.g. ["17", "05/2020", "probability"]
         * @returns {number}
         */
        getTopGroupIndex(groupValues) {
            return this._cols.findIndex((topGroup) => {
                const index = topGroup.findIndex(
                    (values) => JSON.stringify(values) === JSON.stringify(groupValues)
                );
                return index !== -1;
            });
        }

        /**
         * From row group values, find the row index in the pivot.
         * @param {Array<string>} groupValues
         * @returns {number}
         */
        getRowIndex(groupValues) {
            const stringifiedValues = JSON.stringify(groupValues);
            return this._rows.findIndex((values) => JSON.stringify(values) === stringifiedValues);
        }

        /**
         * Given some group values, return to which group level they belong.
         * @param {Array<string>} groupValues
         * @returns {number}
         */
        getSubgroupLevel(groupValues) {
            return groupValues.length - 1;
        }

        isUsedValue(pivotArgs) {
            return this._usedValueDomains.has(pivotArgs.join());
        }

        isUsedHeader(pivotArgs) {
            return this._usedHeaderDomains.has(pivotArgs.join());
        }

        markAsValueUsed(domain, measure) {
            const toTag = domain.slice();
            toTag.unshift(measure);
            this._usedValueDomains.add(toTag.join());
        }

        markAsHeaderUsed(domain) {
            this._usedHeaderDomains.add(domain.join());
        }

        /**
         * Compute and aggregate measures satisfying a given domain.
         * @param {Object} evalContext should contains aggregation functions.
         * @param {string} measureName
         * @param {string} operator
         * @param  {Array<string>} domain
         */
        getMeasureValue(evalContext, measureName, operator, domain) {
            const measureIds = this._computeMeasureIds(domain);
            return this._aggregateMeasure(evalContext, measureIds, measureName, operator);
        }

        getModelLabel() {
            return this._modelLabel;
        }

        /**
         * Return a copy of the cache with an updated label.
         * @param {string} field
         * @param {string} fieldValue
         * @param {string} label
         * @returns {Object}
         */
        withLabel(field, fieldValue, label) {
            const labels = Object.assign({}, this._labels);
            labels[field] = Object.assign({}, labels[field], { [fieldValue]: label });
            return new PivotCache({
                cols: this._cols,
                colStructure: this._colStructure,
                fields: this._fields,
                orderedMeasureIds: this._orderedMeasureIds,
                labels: labels,
                modelLabel: this._modelLabel,
                rows: this._rows,
                values: this._values,
            });
        }

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Compute the values corresponding to a pivot and a given domain
         *
         * For that, we take the intersection of all group_bys
         *
         * @private
         * @param  {Array<string>} domain Domain
         *
         * @returns List of measure ids
         */
        _computeMeasureIds(domain) {
            let returnValue = this._cacheKeys;
            let i = 0;
            while (i < domain.length && returnValue.length) {
                const field = toString(domain[i]);
                if (!(field in this._orderedMeasureIdsByValues)) {
                    return [];
                }
                const value = toString(domain[i + 1]);
                if (!(value in this._orderedMeasureIdsByValues[field])) {
                    return [];
                }
                const measureIds = this._orderedMeasureIdsByValues[field][value] || [];
                returnValue = measureIds.filter((x) => binarySearch(returnValue, x));
                i += 2;
            }
            return returnValue;
        }

        /**
         * Process the values computed to return one value
         *
         * @private
         * @param {Object} evalContext (See EvalContext in o-spreadsheet)
         * @param {Array<number>} measureIds
         * @param {string} measureName Name of the measure
         *
         * @returns Computed value
         */
        _aggregateMeasure(evalContext, measureIds, measureName, operator) {
            if (measureIds.length === 0) {
                return "";
            }
            if (measureIds.length === 1) {
                return this._values[measureIds[0]][measureName] || "";
            }
            switch (operator) {
                case "array_agg":
                    throw Error(_.str.sprintf(_t("Not implemented: %s"), operator));
                case "count":
                    return evalContext.COUNT(
                        ...measureIds.map((id) => this._values[id][measureName] || 0)
                    );
                case "count_distinct":
                    return evalContext.COUNTUNIQUE(
                        ...measureIds.map((id) => measureIds[id][measureName] || 0)
                    );
                case "bool_and":
                    return evalContext.AND(
                        ...measureIds.map((id) => this._values[id][measureName] || 0)
                    );
                case "bool_or":
                    return evalContext.OR(
                        ...measureIds.map((id) => this._values[id][measureName] || 0)
                    );
                case "max":
                    return evalContext.MAX(
                        ...measureIds.map((id) => this._values[id][measureName] || 0)
                    );
                case "min":
                    return evalContext.MIN(
                        ...measureIds.map((id) => this._values[id][measureName] || 0)
                    );
                case "avg":
                    return evalContext["AVERAGE.WEIGHTED"](
                        ...measureIds
                            .map((id) => [
                                this._values[id][measureName] || 0,
                                this._values[id]["count"],
                            ])
                            .flat()
                    );
                case "sum":
                    return evalContext.SUM(
                        ...measureIds.map((id) => this._values[id][measureName] || 0)
                    );
                default:
                    console.warn(_.str.sprintf(_t("Unknown operator: %s"), operator));
                    return "";
            }
        }
    }
    PivotCache.EXPAND_GROUPS_THRESHOLD = 50000;
    return PivotCache;
});
