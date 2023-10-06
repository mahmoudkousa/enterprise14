 odoo.define("documents_spreadsheet.pivot_utils", function (require) {
    "use strict";

    /**
     * @typedef {Object} Pivot
     * @property {(PivotCache|{})} cache
     * @property {Array<string>} colGroupBys
     * @property {Object} context
     * @property {Array} domain
     * @property {Array<string>} measures
     * @property {string} model
     * @property {Array<string>} rowGroupBys
     */

    const core = require("web.core");
    const _t = core._t;
    const Domain = require('web.Domain');
    const pyUtils = require('web.py_utils');

    const PivotCache = require("documents_spreadsheet.pivot_cache");
    const { parse, astToFormula, normalize } = require("documents_spreadsheet.spreadsheet");
    const { Model } = require("documents_spreadsheet.spreadsheet");

    const pivotFormulaRegex = /^=.*PIVOT/;

    const formats = {
        "day": { in: "DD MMM YYYY", out: "DD/MM/YYYY", display: "DD MMM YYYY", interval: "d" },
        "week": { in: "[W]W YYYY", out: "WW/YYYY", display: "[W]W YYYY", interval: "w" },
        "month": { in: "MMMM YYYY", out: "MM/YYYY", display: "MMMM YYYY", interval: "M" },
        "quarter": { in: "Q YYYY", out: "Q/YYYY", display: "[Q]Q YYYY", interval: "Q" },
        "year": { in: "YYYY", out: "YYYY", display: "YYYY", interval: "y" },
    }

    const periods = {
        "day": _t("Day"),
        "week": _t("Week"),
        "month": _t("Month"),
        "quarter": _t("Quarter"),
        "year": _t("Year"),
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Create the cache of the given pivot
     *
     * @param {Pivot} pivot
     * @param {Function} rpc Rpc function to use
     * @param {Object} params
     * @param {boolean} params.dataOnly fetch only read_group data if possible
     * @param {boolean} params.initialDomain=false only refresh the data with the domain of the pivot,
     *                                      without the global filters
     */
    async function createPivotCache(pivot, rpc, { dataOnly = false, initialDomain = false } = {}) {
        const domain = (!initialDomain && pivot.computedDomain) || pivot.domain;
        const readGroupRPC = rpc({
            model: pivot.model,
            method: "read_group",
            context: pivot.context,
            domain,
            fields: pivot.measures.map((elt) =>
                elt.field === "__count" ? elt.field : elt.field + ":" + elt.operator
            ),
            groupBy: pivot.rowGroupBys.concat(pivot.colGroupBys),
            lazy: false,
        });
        const fieldsPromise = _fetchFields(rpc, pivot, { forceRefetch: !dataOnly })
        const modelNamePromise = _fetchModelName(rpc, pivot, { forceRefetch: !dataOnly });
        const resultGB = await readGroupRPC;
        const resultFG = await fieldsPromise;
        const resultSR = await modelNamePromise;
        pivot.cache = await _createCache(resultGB, resultFG, resultSR, pivot, rpc);
    }

    /**
     * Returns all fields descriptions of the pivot model
     * @param {Function} rpc
     * @param {Pivot} pivot
     * @param {Object} params
     * @param {boolean} params.forceRefetch
     * @returns {Promise<Array<Object>>}
     */
    async function _fetchFields(rpc, pivot, { forceRefetch }) {
        if (!forceRefetch && pivot.cache && Object.keys(pivot.cache).length !== 0) {
            return pivot.cache.getFields();
        }
        else {
            return rpc({
                model: pivot.model,
                method: "fields_get",
            });
        }
    }

    /**
     * Returns the pivot model display name
     * @param {Function} rpc
     * @param {Pivot} pivot
     * @param {Object} params
     * @param {boolean} params.forceRefetch
     * @returns {Promise<string>}
     */
    async function _fetchModelName(rpc, pivot, { forceRefetch }) {
        if (!forceRefetch && pivot.cache) {
            return pivot.cache.getModelLabel();
        }
        else {
            const result = await rpc({
                model: "ir.model",
                method: "search_read",
                fields: ["name"],
                domain: [["model", "=", pivot.model]],
            });
            return result[0] && result[0].name;
        }
    }
    /**
     * Fill the cache of the pivot object given
     *
     * @private
     * @param {Pivot} pivot Pivot object
     * @param {Function} rpc Rpc function to use
     * @param {Object} params
     * @param {boolean} params.dataOnly=false only refresh the data, not the structure of the pivot
     * @param {boolean} params.force=false Force to refresh the cache
     * @param {boolean} params.initialDomain=false only refresh the data with the domain of the pivot,
     *                                      without the global filters
     */
    async function fetchCache(pivot, rpc, { dataOnly = false, force = false, initialDomain = false } = {}) {
        if (force) {
            pivot.lastUpdate = undefined;
        }
        if (!pivot.lastUpdate) {
            pivot.lastUpdate = Date.now();
            pivot.promise = createPivotCache(pivot, rpc,  { dataOnly, initialDomain });
        }
        await pivot.promise;
    }
    /**
     * Fetch the labels which do not exist on the cache (it could happen for
     * exemple in multi-company).
     * It also update the cache to avoid further rpc.
     *
     * @param {Pivot} pivot
     * @param {Function} rpc Rpc function to use
     * @param {string} field Name of the field
     * @param {string} value Value
     *
     * @returns {Promise<string>}
     */
    async function fetchLabel(pivot, rpc, field, value) {
        const model = pivot.cache.getField(field).relation;
        const label = rpc({
            model,
            method: 'name_get',
            args: [parseInt(value, 10)],
        }).then((result) => result && result[0] && result[0][1] || undefined);
        pivot.cache = pivot.cache.withLabel(field, value, label);
        return pivot.cache.getGroupLabel(field, value);
    }

    /**
     * Format a data
     *
     * @param {string} field fieldName:interval
     * @param {string} value
     */
    function formatDate(field, value) {
        const interval = field.split(":")[1];
        const output = formats[interval].display;
        const input = formats[interval].out;
        const date = moment(value, input);
        return date.isValid() ? date.format(output) : _t("(Undefined)");
    }
    /**
     * Format the given groupby
     * @param {Pivot} pivot
     * @param {string} gp Groupby to format
     *
     * @returns groupby formatted
     */
    function formatGroupBy(pivot, gp) {
        if (!pivot.isLoaded) {
            return gp;
        }
        let [name, period] = gp.split(":");
        period = periods[period];
        const field = pivot.cache.getField(name);
        return (field ? field.string : name) + (period ? ` (${period})` : "");
    }
    /**
     * Format a header value
     *
     * @param {Pivot} pivot
     * @param {string} groupBy e.g. stage_id, create_date:month
     * @param {string} value Value
     */
    function formatHeader(pivot, groupBy, value) {
        if (groupBy === "measure") {
            if (value === "__count") {
                return _t("Count");
            }
            const field = pivot.cache.getField(value);
            return field ? field.string : value;
        }
        const field = pivot.cache.getField(groupBy.split(":")[0]);
        if (field && ["date", "datetime"].includes(field.type)) {
            return formatDate(groupBy, value);
        }
        return pivot.cache.getGroupLabel(groupBy, value);
    }
    /**
     * Create the pivot object
     *
     * @param {Object} payload Pivot payload (See PivotModel)
     *
     * @returns {Pivot}
     */
    function sanitizePivot(payload) {
        let measures = _sanitizeFields(payload.measures, payload.fields);
        measures = payload.measures.map((measure) => {
            const fieldName = measure.split(":")[0];
            const fieldDesc = payload.fields[fieldName];
            const operator = (fieldDesc.group_operator && fieldDesc.group_operator.toLowerCase()) || (fieldDesc.type === "many2one" ? "count_distinct" : "sum");
            return {
                field: measure,
                operator,
            };
        });
        const rowGroupBys = _sanitizeFields(payload.rowGroupBys, payload.fields);
        const colGroupBys = _sanitizeFields(payload.colGroupBys, payload.fields);
        return {
            model: payload.modelName,
            rowGroupBys,
            colGroupBys,
            measures,
            domain: payload.domain,
            context: payload.context,
        };
    }
    /**
     * Applies a transformation function to all given cells.
     * The transformation function takes as fist parameter the cell AST and should
     * return a modified AST.
     * Any additional parameter is forwarded to the transformation function.
     *
     * @param {Array<Object>} cells
     * @param {Function} convertFunction
     * @param {...any} args
     */
    function convertFormulas(cells, convertFunction, ...args) {
        cells.forEach((cell) => {
            const {text, dependencies} = normalize(cell.content);
            const ast = convertFunction(parse(text), dependencies, ...args);
            cell.content = ast ? `=${astToFormula(ast, dependencies)}`: "";
        });
    }

    /**
     * Helper function to convert PIVOT formulas.
     * Fetch all pivot caches before applying the transformation function.
     * Caches are removed after the transformation.
     * @see convertFormulas
     * @param {Function} rpc
     * @param {Array<Object>} cells
     * @param {Function} convertFunction
     * @param {Array<Object>} pivots
     * @param  {...any} args
     */
    async function convertPivotFormulas(rpc, cells, convertFunction, pivots, ...args) {
        if (!pivots || pivots.length === 0) return;
        await Promise.all(Object.values(pivots).map((pivot) => fetchCache(pivot, rpc)));
        convertFormulas(cells, convertFunction, pivots, ...args);
        Object.values(pivots).forEach((pivot) => {
            pivot.cache = undefined;
            pivot.lastUpdate = undefined;
            pivot.isLoaded = false;
        })
    }
    /**
     * return AST from an absolute PIVOT ast to a relative ast.
     *
     * Absolute PIVOT formulas use hardcoded ids while relative PIVOTS
     * formulas use the position
     *
     * e.g.
     * The following absolute formula
     *      `PIVOT("1","probability","product_id","37","bar","110")`
     * is converted to
     *      `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",0),"bar","110")`
     * @param {Object} ast
     * @param {Array<string|number>} dependencies
     * @param {Object} pivots
     * @returns {Object}
     */
    function absoluteToRelative(ast, dependencies, pivots) {
        switch (ast.type) {
            case "ASYNC_FUNCALL":
            case "FUNCALL":
                switch (ast.value) {
                    case "PIVOT":
                        return _pivotAbsoluteToRelative(ast, dependencies, pivots);
                    case "PIVOT.HEADER":
                        return _pivotHeaderAbsoluteToRelative(ast, dependencies, pivots);
                    default:
                        return Object.assign({}, ast, {
                            args: ast.args.map((child) => absoluteToRelative(child, dependencies, pivots)),
                        });
                }
            case "UNARY_OPERATION":
                return Object.assign({}, ast, {
                    right: absoluteToRelative(ast.right, dependencies, pivots),
                });
            case "BIN_OPERATION":
                return Object.assign({}, ast, {
                    right: absoluteToRelative(ast.right, dependencies, pivots),
                    left: absoluteToRelative(ast.left, dependencies, pivots),
                });
        }
        return ast;
    }
    /**
     * return AST from an relative PIVOT ast to a absolute PIVOT ast (sheet -> template)
     * *
     * relative PIVOTS formulas use the position while Absolute PIVOT
     * formulas use hardcoded ids
     *
     * e.g.
     * The following relative formula
     *      `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",0),"bar","110")`
     * is converted to
     *      `PIVOT("1","probability","product_id","37","bar","110")`
     * @param {Object} ast
     * @param {Array<string|number>} dependencies
     * @param {Object} pivots
     * @returns {Object}
     */
    function relativeToAbsolute(ast, dependencies, pivots) {
        switch (ast.type) {
            case "ASYNC_FUNCALL":
            case "FUNCALL":
                switch (ast.value) {
                    case "PIVOT.POSITION":
                        return _pivotPositionToAbsolute(ast, dependencies, pivots);
                    default:
                        return Object.assign({}, ast, {
                            args: ast.args.map((child) => relativeToAbsolute(child, dependencies, pivots)),
                        });
                }
            case "UNARY_OPERATION":
                return Object.assign({}, ast, {
                    right: relativeToAbsolute(ast.right, dependencies, pivots),
                });
            case "BIN_OPERATION":
                return Object.assign({}, ast, {
                    right: relativeToAbsolute(ast.right, dependencies, pivots),
                    left: relativeToAbsolute(ast.left, dependencies, pivots),
                });
        }
        return ast;
    }

    /**
     * Takes a template id as input, will convert the formulas
     * from relative to absolute in a way that they can be used to create a sheet.
     * @param {number} templateId
     * @returns {Promise<Object>} spreadsheetData
     */
    async function getDataFromTemplate(rpc, templateId) {
        let [{ data }] = await rpc({
            method: "read",
            model: "spreadsheet.template",
            args: [templateId, ["data"]],
        });
        data = base64ToJson(data);
        const { pivots } = data;
        await convertPivotFormulas(rpc, getCells(data, pivotFormulaRegex) , relativeToAbsolute, pivots);
        return _removeInvalidPivotRows(rpc, data);
    }

    /**
     * Return all cells matching a given regular expression.
     * @param {Object} data
     * @param {RegExp} regex
     * @returns {Array<Object>}
     */
    function getCells(data, regex) {
        return Object.values(data.sheets || [])
            .map((sheet) => Object.values(sheet.cells))
            .flat()
            .filter((cell) => regex.test(cell.content));
    }


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Remove pivot formulas with invalid ids.
     * i.e. pivot formulas containing "#IDNOTFOUND".
     *
     * Rows where all pivot formulas are invalid are removed, even
     * if there are others non-empty cells.
     * Invalid formulas next to valid ones (in the same row) are simply removed.
     * @param {Function} rpc
     * @param {Object} data spreadsheet data
     * @returns {Object} cleaned spreadsheet data
     */
    function _removeInvalidPivotRows(rpc, data) {
        const model = new Model(data,{
            mode: "headless",
            evalContext: {
                env: {
                    services: { rpc },
                },
            },
        });
        for (let sheet of model.getters.getSheets()) {
            const invalidRows = [];
            for (let rowIndex = 0; rowIndex < model.getters.getNumberRows(sheet.id); rowIndex++) {
                const { cells } = model.getters.getRow(sheet.id, rowIndex);
                const [valid, invalid] = Object.values(cells)
                    .filter((cell) => pivotFormulaRegex.test(cell.content))
                    .reduce(
                        ([valid, invalid], cell) => {
                            const isInvalid = /^\s*=.*PIVOT(\.HEADER)?.*#IDNOTFOUND/.test(cell.content);
                            return [isInvalid ? valid : valid + 1, isInvalid ? invalid + 1 : invalid];
                        },
                        [0, 0]
                    );
                if (invalid > 0 && valid === 0) {
                    invalidRows.push(rowIndex);
                }
            }
            model.dispatch("REMOVE_ROWS", { rows: invalidRows, sheet: sheet.id });
        }
        data = model.exportData();
        convertFormulas(
            getCells(data, /^\s*=.*PIVOT.*#IDNOTFOUND/),
            () => null,
        );
        return data;
    }
    /**
     * Convert an absolute PIVOT function AST to a relative AST
     *
     * @see absoluteToRelative
     * @param {Object} ast
     * @param {Array<string|number>} dependencies
     * @param {Object} pivots
     * @returns {Object}
     */
    function _pivotAbsoluteToRelative(ast, dependencies, pivots) {
        ast = Object.assign({}, ast);
        const [pivotIdAst, measureAst, ...domainAsts] = ast.args;
        if (pivotIdAst.type !== "NORMALIZED_STRING") return ast;
        ast.args = [
            pivotIdAst,
            measureAst,
            ..._domainToRelative(pivots, pivotIdAst, domainAsts, dependencies),
        ];
        return ast;
    }
    /**
     * Convert an absolute PIVOT.HEADER function AST to a relative AST
     *
     * @see absoluteToRelative
     * @param {Object} ast
     * @param {Array<string|number>} dependencies
     * @param {Object} pivots
     * @returns {Object}
     */
    function _pivotHeaderAbsoluteToRelative(ast, dependencies, pivots) {
        ast = Object.assign({}, ast);
        const [pivotIdAst, ...domainAsts] = ast.args;
        if (pivotIdAst.type !== "NORMALIZED_STRING") return ast;
        ast.args = [
            pivotIdAst,
            ..._domainToRelative(pivots, pivotIdAst, domainAsts, dependencies),
        ];
        return ast;
    }
    /**
     * Convert a PIVOT.POSITION function AST to an absolute AST
     *
     * @see relativeToAbsolute
     * @param {Object} ast
     * @param {Array<string|number>} dependencies
     * @param {Object} pivots
     * @returns {Object}
     */
    function _pivotPositionToAbsolute(ast, dependencies, pivots) {
        const [pivotIdAst, fieldAst, positionAst] = ast.args;
        const pivotId = dependencies[JSON.parse(pivotIdAst.value)];
        const fieldName = dependencies[JSON.parse(fieldAst.value)];
        const position = dependencies[JSON.parse(positionAst.value)];
        const id = pivots[pivotId].cache.getFieldValues(fieldName)[position - 1];
        return {
            value: id ? `"${id}"` : `"#IDNOTFOUND"`,
            type: id ? "STRING": "UNKNOWN",
        };
    }

    /**
     * Convert a pivot domain with hardcoded ids to a relative
     * domain with positions instead. Each domain element is
     * represented as an AST.
     *
     * e.g. (ignoring AST representation for simplicity)
     * The following domain
     *      "product_id", "37", "stage_id", "4"
     * is converted to
     *      "product_id", PIVOT.POSITION("#pivotId", "product_id", 15), "stage_id", PIVOT.POSITION("#pivotId", "stage_id", 3)
     * @param {Object} pivots
     * @param {Object} pivotIdAst
     * @param {Object} domainAsts
     * @param {Array<string|number>} dependencies
     * @returns {Array<Object>}
     */
    function _domainToRelative(pivots, pivotIdAst, domainAsts, dependencies) {
        let relativeDomain = [];
        for (let i = 0; i <= domainAsts.length - 1; i += 2) {
            const fieldAst = domainAsts[i];
            const valueAst = domainAsts[i + 1];
            const pivotId = dependencies[JSON.parse(pivotIdAst.value)];
            const pivot = pivots[pivotId];
            const fieldName = dependencies[JSON.parse(fieldAst.value)];

            if (
                _isAbsolute(fieldName, pivot) &&
                fieldAst.type === "NORMALIZED_STRING" &&
                ["NORMALIZED_STRING", "NORMALIZED_NUMBER"].includes(valueAst.type)
            ) {
                const id = dependencies[JSON.parse(valueAst.value)];
                const index = pivot.cache.getFieldValues(fieldName).indexOf(id.toString());
                relativeDomain = relativeDomain.concat([
                    fieldAst,
                    {
                        type: "FUNCALL",
                        value: "PIVOT.POSITION",
                        args: [pivotIdAst, fieldAst, { type: "NUMBER", value: index + 1 }],
                    },
                ]);
            } else {
                relativeDomain = relativeDomain.concat([fieldAst, valueAst]);
            }
        }
        return relativeDomain;
    }

    function _isAbsolute(fieldName, pivot) {
        const field = pivot.cache.getField(fieldName.split(":")[0])
        return field && field.type === "many2one";
    }
    /**
     * Create a cache for the given pivot from the result of the rpcs
     * (read_group, fields_get, search_read)
     *
     * @param {Object} readGroupResult Result of the read_group rpc
     * @param {Object} fieldsGetResult Result of the fields_get rpc
     * @param {string} modelLabel
     * @param {Pivot} pivot Pivot object
     * @param {Function} rpc
     *
     * @private
     * @returns {PivotCache} Cache for pivot object
     */
    async function _createCache(readGroupResult, fieldsGetResult, modelLabel, pivot, rpc) {
        const groupBys = {};
        const labels = {};
        const values = [];

        const fieldNames = pivot.rowGroupBys.concat(pivot.colGroupBys);
        for (let fieldName of fieldNames) {
            labels[fieldName] = {};
        }

        for (let readGroup of readGroupResult) {
            const value = {};
            for (let measure of pivot.measures) {
                const field = measure.field;
                value[field] = readGroup[field];
            }
            value["count"] = readGroup["__count"];
            const index = values.push(value) - 1;
            for (let fieldName of fieldNames) {
                const { label, id } = _formatValue(
                    fieldName,
                    readGroup[fieldName],
                    fieldsGetResult
                );
                labels[fieldName][id] = label;
                let groupBy = groupBys[fieldName] || {};
                let vals = groupBy[id] || [];
                vals.push(index);
                groupBy[id] = vals;
                groupBys[fieldName] = groupBy;
            }
        }
        const orderedValues = await _getOrderedValues(pivot, groupBys, fieldsGetResult, rpc);
        const orderedMeasureIds = {};
        for (const fieldName of fieldNames) {
            orderedMeasureIds[fieldName] = orderedValues[fieldName]
                ? orderedValues[fieldName].map((value) => [value, groupBys[fieldName][value] || []])
                : [];
        }

        const measures = pivot.measures.map((m) => m.field);
        const numberOfValues = Object.values(orderedValues)
            .map((groupValues) => groupValues.length)
            .reduce((a, b) => a * b, 1);
        console.log(numberOfValues, numberOfValues < PivotCache.EXPAND_GROUPS_THRESHOLD, PivotCache.EXPAND_GROUPS_THRESHOLD)
        const rows = _createRows(
            pivot.rowGroupBys,
            orderedMeasureIds,
            numberOfValues < PivotCache.EXPAND_GROUPS_THRESHOLD
        );
        const cols = _createCols(pivot.colGroupBys, orderedMeasureIds, measures);
        const colStructure = pivot.colGroupBys.slice();
        colStructure.push("measure");
        return new PivotCache({
            cols,
            colStructure,
            fields: fieldsGetResult,
            orderedMeasureIds,
            labels,
            modelLabel,
            rows,
            values,
        });
    }

    /**
     * Return all possible values for each grouped field. Values are ordered according
     * to the read group result.
     * e.g.
     *  {
     *      field1: [value1, value2, value3],
     *      field2: [value1, value2],
     *  }
     * @param {Object} params rpc params
     * @param {string} params.model model name
     * @param {Object} params.context
     * @param {Object} groupBys
     * @param {Object} fields
     * @param {Function} rpc
     * @returns {Object}
     */
    async function _getOrderedValues({ model, context, domain }, groupBys, fields, rpc) {
        return Object.fromEntries(
            await Promise.all(
                Object.entries(groupBys).map(async ([groupBy, measures]) => {
                    const [fieldName, aggregationFunction] = groupBy.split(":");
                    const field = fields[fieldName];
                    let values = Object.keys(measures);
                    const hasUndefined = values.includes("false");
                    values = ["date", "datetime"].includes(field.type)
                        ? _orderDateValues(values.filter((value) => value !== "false"), aggregationFunction)
                        : await _orderValues(values, fieldName, field, model, domain, context, rpc);
                    if (hasUndefined && field.type !== "boolean") {
                        values.push("false");
                    }
                    return [groupBy, values];
                })
            )
        );
    }

    /**
     * Sort date and datetime aggregated values.
     * @param {Array<string>} values
     * @param {string} aggregationFunction
     * @returns {Array<string>}
     */
    function _orderDateValues(values, aggregationFunction) {
        return aggregationFunction === "quarter"
            ? values.sort()
            : values
                  .map((value) => moment(value, formats[aggregationFunction].out))
                  .sort((a, b) => a - b)
                  .map((value) => value.format(formats[aggregationFunction].out));
    }

    /**
     * Order values according to a search_read result.
     * @param {Array} values
     * @param {string} fieldName
     * @param {Object} field
     * @param {string} model
     * @param {Array} baseDomain
     * @param {Object} context
     * @param {Function} rpc
     * @returns {Array}
     */
    async function _orderValues(values, fieldName, field, model, baseDomain, context, rpc) {
        const requestField = field.relation ? "id" : fieldName;
        values = ["boolean", "many2one", "integer", "float"].includes(field.type)
            ? values.map((value) => JSON.parse(value))
            : values;
        const domainString = pyUtils.assembleDomains([
            field.relation ? "[]" : Domain.prototype.arrayToString(baseDomain),
            Domain.prototype.arrayToString([[requestField, "in", values]]),
            ], "AND");
        const domain = pyUtils.eval("domain", domainString, {});
        const records = await rpc({
            model: field.relation ? field.relation : model,
            domain,
            context: Object.assign({}, context, { active_test: false }),
            method: "search_read",
            fields: [requestField],
            // orderby is omitted for relational fields on purpose to have the default order of the model
            orderBy: field.relation ? false : [{name: fieldName, asc: true}]
        });
        return [...new Set(records.map((record) => record[requestField].toString()))];
    }
    /**
     * Create the columns structure
     *
     * @param {Array<string>} groupBys Name of the fields of colGroupBys
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     * @param {Array<string>} measures Measures
     *
     * @private
     * @returns {Array<Array<Array<string>>>} cols
     */
    function _createCols(groupBys, values, measures) {
        const cols = [];
        if (groupBys.length !== 0) {
            _fillColumns(cols, [], [], groupBys, measures, values, false);
        }
        for (let field of measures) {
            cols.push([[], [field]]); // Total
        }
        return cols;
    }
    /**
     * Create the rows structure
     *
     * @param {Array<string>} groupBys Name of the fields of rowGroupBys
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     * @param {boolean} expand add all values in every subgroup
     *
     * @private
     * @returns {Array<Array<string>>} rows
     */
    function _createRows(groupBys, values, expand) {
        const rows = [];
        _fillRows(rows, [], groupBys, values, false, expand);
        rows.push([]); // Total
        return rows;
    }
    /**
     * Retrieves the id and the label of a field/value. It also convert dates
     * to non-locale version (i.e. March 2020 => 03/2020)
     *
     * @param {string} fieldDesc Field (create_date:month)
     * @param {string} value Value
     * @param {Object} fieldsGetResult Result of a field_get rpc
     *
     * @private
     * @returns {Object} Label and id formatted
     */
    function _formatValue(fieldDesc, value, fieldsGetResult) {
        const [ fieldName, group ] = fieldDesc.split(":");
        const field = fieldsGetResult[fieldName];
        let id;
        let label;
        if (value instanceof Array) {
            id = value[0];
            label = value[1];
        } else {
            id = value;
            label = value;
        }
        if (field && field.type === "selection") {
            const selection = field.selection.find(x => x[0] === id);
            label = selection && selection[1];
        }
        if (field && ["date", "datetime"].includes(field.type) && group && value) {
            const fIn = formats[group]["in"];
            const fOut = formats[group]["out"];
            const date = moment(value, fIn)
            id = date.isValid() ? date.format(fOut) : false;
            label = id;
        }
        return { label, id };
    }
    /**
     * Get the intersection of two arrays
     *
     * @param {Array} a
     * @param {Array} b
     *
     * @private
     * @returns {Array} intersection between a and b
     */
    function _intersect(a, b) {
        return a.filter((x) => b.includes(x));
    }
    /**
     * fill the columns structure
     *
     * @param {Array} cols Columns to fill
     * @param {Array} currentRow Current value of a row
     * @param {Array} currentCol Current value of a col
     * @param {Array<string>} groupBys Name of the fields of colGroupBys
     * @param {Array<string>} measures Measures
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     * @param {Array<number|false} currentIds Ids used to compute the intersection
     *
     * @private
     */
    function _fillColumns(cols, currentRow, currentCol, groupBys, measures, values, currentIds) {
        const field = groupBys[0];
        if (!field) {
            for (let measure of measures) {
                const row = currentRow.slice();
                const col = currentCol.slice();
                row.push(measure);
                col.push(row);
                cols.push(col);
            }
            return;
        }
        for (let [id, vals] of values[field] || []) {
            let ids = currentIds ? _intersect(currentIds, vals) : vals;
            const row = currentRow.slice();
            const col = currentCol.slice();
            row.push(id);
            col.push(row);
            _fillColumns(cols, row, col, groupBys.slice(1), measures, values, ids);
        }
    }
    /**
     * Fill the rows structure
     *
     * @param {Array} rows Rows to fill
     * @param {Array} currentRow Current value of a row
     * @param {Array<string>} groupBys Name of the fields of colGroupBys
     * @param {Object} values Values of the pivot (see PivotCache.groupBys)
     * @param {Array<number>|false} currentIds Ids used to compute the intersection
     * @param {boolean} expand add all values in every subgroup
     *
     * @private
     */
    function _fillRows(rows, currentRow, groupBys, values, currentIds, expand) {
        if (groupBys.length === 0) {
            return;
        }
        const fieldName = groupBys[0];
        for (let [id, vals] of values[fieldName] || []) {
            let ids = currentIds ? _intersect(currentIds, vals) : vals;
            if (expand || ids.length !== 0) {
                const row = currentRow.slice();
                row.push(id);
                rows.push(row);
                _fillRows(rows, row, groupBys.slice(1), values, ids, expand);
            }
        }
    }
    /**
     * Add a default interval for the date and datetime fields
     *
     * @param {Array<string>} fields List of the fields to sanitize
     * @param {Object} allFields fields_get result
     */
    function _sanitizeFields(fields, allFields) {
        return fields.map((field) => {
            let [ fieldName, group ] = field.split(":");
            const fieldDesc = allFields[fieldName];
            if (["date", "datetime"].includes(fieldDesc.type)) {
                if (!group) {
                    group = "month";
                }
                return `${fieldName}:${group}`;
            }
            return fieldName;
        })
    }

    /**
     * Wait util all the async cells in spreadsheet are computed
     *
     * @param {Object} getters Getters of Spreadsheet model
     */
    async function waitForIdle(getters) {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (getters.isIdle()) {
                    clearInterval(interval);
                    resolve();
                }
            }, 20)
        })
    }

    /**
     * see https://stackoverflow.com/a/30106551
     * @param {string} string
     * @returns {string}
     */
     function utf8ToBase64(str) {
        // first we use encodeURIComponent to get percent-encoded UTF-8,
        // then we convert the percent encodings into raw bytes which
        // can be fed into btoa.
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
        }));
    }

    /**
     * see https://stackoverflow.com/a/30106551
     * @param {string} string
     * @returns {string}
     */
    function base64ToUtf8(str) {
        // Going backwards: from bytestream, to percent-encoding, to original string.
        return decodeURIComponent(
            atob(str)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
    }

    /**
     * Encode a json to a base64 string
     * @param {object} json
     */
    function jsonToBase64(json) {
        return utf8ToBase64(JSON.stringify(json));
    }

    /**
     * Decode a base64 encoded json
     * @param {string} string
     */
    function base64ToJson(string) {
        return JSON.parse(base64ToUtf8(string));
    }

    return {
        base64ToJson,
        jsonToBase64,
        absoluteToRelative,
        createPivotCache,
        convertFormulas,
        convertPivotFormulas,
        getCells,
        fetchCache,
        formatDate,
        fetchLabel,
        formatGroupBy,
        formatHeader,
        formats,
        getDataFromTemplate,
        relativeToAbsolute,
        sanitizePivot,
        pivotFormulaRegex,
        waitForIdle,
    };
});
