odoo.define("documents_spreadsheet.autofill", function (require) {
    "use strict";

    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const UP = 0;
    const DOWN = 1;
    const LEFT = 2;
    const RIGHT = 3;
    const autofillRulesRegistry = spreadsheet.registries.autofillRulesRegistry;
    const autofillModifiersRegistry = spreadsheet.registries.autofillModifiersRegistry;

    //--------------------------------------------------------------------------
    // Autofill Component
    //--------------------------------------------------------------------------
    class AutofillTooltip extends owl.Component {}
    AutofillTooltip.template = "documents_spreadsheet.AutofillTooltip";

    //--------------------------------------------------------------------------
    // Autofill Rules
    //--------------------------------------------------------------------------

    autofillRulesRegistry.add("autofill_pivot", {
        condition: (cell) => cell && cell.type === "formula" && cell.content.match(/=\s*PIVOT/),
        generateRule: (cell, cells) => {
            const increment = cells.filter(
                (cell) => cell && cell.type === "formula" && cell.content.match(/=\s*PIVOT/)
            ).length;
            return { type: "PIVOT_UPDATER", increment, current: 0 };
        },
        sequence: 10,
    }).add("autofill_pivot_position", {
        condition: (cell) => cell && cell.type === "formula" && cell.content.match(/=.*PIVOT.*PIVOT\.POSITION/),
        generateRule: () => ({ type: "PIVOT_POSITION_UPDATER", current: 0 }),
        sequence: 1,
    });

    //--------------------------------------------------------------------------
    // Autofill Modifier
    //--------------------------------------------------------------------------

    autofillModifiersRegistry.add("PIVOT_UPDATER", {
        apply: (rule, data, getters, direction) => {
            rule.current += rule.increment;
            let isColumn;
            let steps;
            switch (direction) {
                case UP:
                    isColumn = false;
                    steps = -rule.current;
                    break;
                case DOWN:
                    isColumn = false;
                    steps = rule.current;
                    break;
                case LEFT:
                    isColumn = true;
                    steps = -rule.current;
                    break;
                case RIGHT:
                    isColumn = true;
                    steps = rule.current;
            }
            const content = getters.getNextValue(data.content, isColumn, steps);
            const tooltip = content ? {
                props: {
                    content: getters.getTooltipFormula(content, isColumn),
                },
                component: AutofillTooltip,
            } : undefined;
            return {
                cellData: {
                    style: undefined,
                    format: undefined,
                    border: undefined,
                    content,
                },
                tooltip,
            };
        },
    }).add("PIVOT_POSITION_UPDATER", {
        /**
         * Increment (or decrement) positions in template pivot formulas.
         * Autofilling vertically increments the field of the deepest row
         * group of the formula. Autofilling horizontally does the same for
         * column groups.
         */
        apply: (rule, data, getters, direction) => {
            const pivotId = data.content.match(/PIVOT\.POSITION\(\s*"(\w+)"\s*,/)[1];
            const pivot = getters.getPivot(pivotId);
            if (!pivot) return data;
            const fields = [UP, DOWN].includes(direction)
                ? pivot.rowGroupBys.slice()
                : pivot.colGroupBys.slice();
            const step = [RIGHT, DOWN].includes(direction) ? 1 : -1;

            const field = fields
                .reverse()
                .find((field) => new RegExp(`PIVOT\\.POSITION.*${field}.*\\)`).test(data.content));
            const content = data.content.replace(
                new RegExp(`(.*PIVOT\\.POSITION\\(\\s*"\\w"\\s*,\\s*"${field}"\\s*,\\s*"?)(\\d+)(.*)`),
                (match, before, position, after) => {
                    rule.current += step;
                    return before + Math.max(parseInt(position) + rule.current, 1) + after;
                }
            );
            return {
                cellData: Object.assign({}, data, { content }),
                tooltip: content ? {
                    props: { content },
                } : undefined,
            }
        },
    });
});
