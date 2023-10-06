odoo.define("documents_spreadsheet.pivot_side_panel", function (require) {
    "use strict";

    const core = require("web.core");
    const { ComponentAdapter } = require("web.OwlCompatibility");
    const DomainSelector = require("web.DomainSelector");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const { sprintf } = require("web.utils");
    const { time_to_str } = require('web.time');

    const _t = core._t;
    const sidePanelRegistry = spreadsheet.registries.sidePanelRegistry;
    const { useState } = owl.hooks;

    /**
     * ComponentAdapter to allow using DomainSelector in a owl Component
     */
    class DomainComponentAdapter extends ComponentAdapter {
        get widgetArgs() {
            return [this.props.model, this.props.domain, { readonly: true, filters: {} }];
        }
    }

    class PivotSidePanel extends owl.Component {
        constructor(parent, props) {
            super(...arguments);
            this.state = useState({
                pivotId: undefined,
            });
            this.pivot = props.pivot;
            this.DomainSelector = DomainSelector;
            this.periods = {
                day: _t("Day"),
                week: _t("Week"),
                month: _t("Month"),
                quarter: _t("Quarter"),
                year: _t("Year"),
            };
        }

        async willUpdateProps(nextProps) {
            this.pivot = nextProps.pivot;
        }

        /**
         * Format the given groupby
         * @param {string} gp Groupby to format
         *
         * @returns groupby formatted
         */
        formatGroupBy(gp) {
            return pivotUtils.formatGroupBy(this.pivot, gp);
        }

        /**
         * Format the given measure
         * @param {string} measure Measure to format
         *
         * @returns measure formatted
         */
        formatMeasure(measure) {
            if (this.pivot && this.pivot.cache) {
                if (measure.field === "__count") {
                    return _t("Count");
                }
                const field = this.pivot.cache.getField(measure.field);
                return field ? field.string : measure.field;
            }
        }

        /**
         * Get the last update date, formatted
         *
         * @returns {string} date formatted
         */
        getLastUpdate() {
            return time_to_str(new Date(this.pivot.lastUpdate));
        }

        /**
         * Refresh the cache of the given pivot
         *
         * @param {number} id Id of the pivot
         */
        refreshMeasures(id) {
            this.env.dispatch("REFRESH_PIVOT", { id });
        }

        getPivotName() {
            if (this.pivot && this.pivot.cache) {
                const modelName = this.pivot.cache.getModelLabel();
                return sprintf("%s (#%s)", modelName, this.pivot && this.pivot.id);
            }
        }
    }
    PivotSidePanel.template = "documents_spreadsheet.PivotSidePanel";
    PivotSidePanel.components = { DomainComponentAdapter };

    sidePanelRegistry.add("PIVOT_PROPERTIES_PANEL", {
        title: (env) => {
            return _t("Pivot properties");
        },
        Body: PivotSidePanel,
    });
});
