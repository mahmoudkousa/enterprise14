odoo.define("documents_spreadsheet.pivot_functions", function (require) {
    "use strict";

    const core = require("web.core");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const _t = core._t;
    const args = spreadsheet.helpers.args;
    const functionRegistry = spreadsheet.registries.functionRegistry;
    const toString = spreadsheet.helpers.toString;

    //--------------------------------------------------------------------------
    // Spreadsheet functions
    //--------------------------------------------------------------------------

    functionRegistry
        .add("FILTER_VALUE", {
            description: _t("Get the value from a filter."),
            compute: async function (filterName) {
                return this.getters.getFilterDisplayValue(filterName)
            },
            async: true,
            args: args(`
                filter_name (string) ${_t("Name of the filter.")}
            `),
            returns: ["STRING"],
        })
        .add("PIVOT", {
            description: _t("Get the value from a pivot."),
            compute: async function (pivotId, measureName, ...domain) {
                const pivot = _getPivot(this.getters, pivotId);
                const measure = toString(measureName);
                _sanitizeArgs(pivot, measure, domain);
                await pivotUtils.fetchCache(pivot, this.env.services.rpc);
                const operator = pivot.measures.filter((m) => m.field === measure)[0].operator;
                pivot.cache.markAsValueUsed(domain, measure);
                return pivot.cache.getMeasureValue(this, measure, operator, domain);
            },
            async: true,
            args: args(`
            pivot_id (string) ${_t("ID of the pivot.")}
            measure_name (string) ${_t("Name of the measure.")}
            domains (string,optional,repeating) ${_t("Domains list.")}
        `),
            // When multi-optional arguments will be implemented:
            // args: args`
            //     pivot_id (string) ID of the pivot.
            //     measure_name (string) Name of the measure.
            //     domains (string,optional,repeating) Field name of the domain.
            //     values (string,optional,repeating) Value for a domain.
            // `,
            returns: ["NUMBER", "STRING"],
        })
        .add("PIVOT_HEADER", {
            description: _t("Get the header of a pivot."),
            compute: async function (pivotId, ...domain) {
                const pivot = _getPivot(this.getters, pivotId);
                await pivotUtils.fetchCache(pivot, this.env.services.rpc);
                pivot.cache.markAsHeaderUsed(domain);
                const len = domain.length;
                if (len === 0) {
                    return _t("Total");
                }
                const fieldName = toString(domain[len - 2]);
                const value = toString(domain[len - 1]);
                if (fieldName === "measure") {
                    if (value === "__count") {
                        return _t("Count");
                    }
                    const field = pivot.cache.getField(value);
                    return field ? field.string : value;
                } else {
                    return (await _getValue(pivot, this.env.services.rpc, fieldName, value)) || "";
                }
            },
            async: true,
            args: args(`
            pivot_id (string) ${_t("ID of the pivot.")}
            domains (string,optional,repeating) ${_t("Domains list.")}
        `),
            returns: ["NUMBER", "STRING"],
        })
        .add("PIVOT.POSITION", {
            description: _t("Get the absolute ID of an element in the pivot"),
            compute: function () {
                throw new Error(
                    _t(`[[FUNCTION_NAME]] cannot be called from the spreadsheet.`)
                );
            },
            args: args(`
                pivot_id (string) ${_t("ID of the pivot.")}
                field_name (string) ${_t("Name of the field.")}
                position (number) ${_t("Position in the pivot")}
            `),
            returns: ["STRING"],
        });

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Get the pivot object with the given ID
     * @param {Object} getters (See EvalContext.getters in o-spreadsheet)
     * @param {string} pivotId Id of the pivot
     *
     * @private
     * @returns {Pivot}
     */
    function _getPivot(getters, pivotId) {
        pivotId = toString(pivotId);
        const pivot = getters.getPivot(pivotId);
        if (!pivot) {
            throw new Error(_.str.sprintf(_t('There is no pivot with id "%s"'), pivotId));
        }
        return pivot;
    }
    /**
     * Return the label to display from a value and a field
     * @param {Pivot} pivot
     * @param {Function} rpc
     * @param {string} fieldName
     * @param {string} value
     * @returns {Promise<string | undefined>}
     */
    async function _getValue(pivot, rpc, fieldName, value) {
        const undef = _t("(Undefined)");
        if (
            !pivot.cache.isGroupLabelLoaded(fieldName, value) &&
            pivot.cache.getField(fieldName.split(":")[0]).relation &&
            value !== "false"
        ) {
            await pivotUtils.fetchLabel(pivot, rpc, fieldName, value);
        }
        const field = pivot.cache.getField(fieldName.split(":")[0]);
        if (field && ["date", "datetime"].includes(field.type)) {
            return pivotUtils.formatDate(fieldName, value);
        }
        return pivot.cache.getGroupLabel(fieldName, value) || undef;
    }
    /**
     * Sanitize arguments given to the PIVOT function
     *
     * @private
     * @param {Pivot} pivot pivot
     * @param {string} measure Name of the measure
     * @param {Array<string>} domain domain (list of field and value)
     *
     */
    function _sanitizeArgs(pivot, measure, domain) {
        if (domain.length % 2 !== 0) {
            throw new Error(_t("Function PIVOT takes an even number of arguments."));
        }
        if (!pivot.measures.map((elt) => elt.field).includes(measure)) {
            const validMeasures = `(${pivot.measure.map((elt) => elt.field)})`;
            throw new Error(_.str.sprintf(_t("The argument %s is not a valid measure. Here are the measures: %s"), measure, validMeasures));
        }
    }
});
