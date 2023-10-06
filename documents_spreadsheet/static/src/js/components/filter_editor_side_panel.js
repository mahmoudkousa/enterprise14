odoo.define("documents_spreadsheet.filter_editor_side_panel", function (require) {
    "use strict";

    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const DateFilterValue = require("documents_spreadsheet.DateFilterValue");
    const CancelledReason = require("documents_spreadsheet.CancelledReason");
    const {
        FieldSelectorWidget,
        FieldSelectorAdapter,
    } = require("documents_spreadsheet.field_selector_widget");
    const {
        ModelSelectorWidget,
        ModelSelectorWidgetAdapter,
    } = require("documents_spreadsheet.model_selector_widget");
    const {
        TagSelectorWidget,
        TagSelectorWidgetAdapter,
    } = require("documents_spreadsheet.tag_selector_widget");

    const _t = core._t;
    const { useState } = owl.hooks;
    const sidePanelRegistry = spreadsheet.registries.sidePanelRegistry;
    const { uuidv4 } = spreadsheet.helpers;

    /**
     * This is the side panel to define/edit a global filter.
     * It can be of 3 differents type: text, date and relation.
     */
    class FilterEditorSidePanel extends owl.Component {
        /**
         * @constructor
         */
        constructor(parent, props) {
            super(...arguments);
            this.id = undefined;
            this.state = useState({
                saved: false,
                label: undefined,
                type: undefined,
                pivotFields: {},
                text: {
                    defaultValue: undefined,
                },
                date: {
                    defaultValue: {},
                    type: undefined, // "year" | "month" | "quarter"
                    options: [],
                },
                relation: {
                    defaultValue: [],
                    displayNames: [],
                    relatedModelID: undefined,
                    relatedModelName: undefined,
                },
            });
            this.pivots = this.env.getters.getPivots();
            this.loadValues(props);
            // Widgets
            this.FieldSelectorWidget = FieldSelectorWidget;
            this.ModelSelectorWidget = ModelSelectorWidget;
            this.TagSelectorWidget = TagSelectorWidget;
        }

        /**
         * Retrieve the placeholder of the label
         */
        get placeholder() {
            return _.str.sprintf(_t("New %s filter"), this.state.type);
        }

        get missingLabel() {
            return this.state.saved && !Boolean(this.state.label);
        }

        get missingField() {
            return this.state.saved && Object.keys(this.state.pivotFields).length === 0;
        }

        get missingModel() {
            return (
                this.state.saved &&
                this.state.type === "relation" &&
                !this.state.relation.relatedModelID
            );
        }

        /**
         * List of model names of all related models of all pivots
         * @returns {Array<string>}
         */
        get relatedModels() {
            return [
                ...new Set(
                    this.env.getters
                        .getPivots()
                        .filter((pivot) => pivot.isLoaded)
                        .map((pivot) => Object.values(pivot.cache.getFields()))
                        .flat()
                        .filter((field) => field.type === "many2one")
                        .map((field) => field.relation)
                ),
            ];
        }

        loadValues(props) {
            this.id = props.id;
            const globalFilter = this.id && this.env.getters.getGlobalFilter(this.id);
            this.state.label = globalFilter && globalFilter.label;
            this.state.type = globalFilter ? globalFilter.type : props.type;
            this.state.pivotFields = globalFilter ? globalFilter.fields : {};
            this.state.date.type =
                this.state.type === "date" && globalFilter ? globalFilter.rangeType : "year";
            if (globalFilter) {
                this.state[this.state.type].defaultValue = globalFilter.defaultValue;
                if (this.state.type === "relation") {
                    this.state.relation.relatedModelName = globalFilter.modelName;
                }
            }
        }

        async willStart() {
            await this.fetchModelFromName();
        }

        async onModelSelected(ev) {
            if (this.state.relation.relatedModelID !== ev.detail.value) {
                this.state.relation.defaultValue = [];
            }
            this.state.relation.relatedModelID = ev.detail.value;
            await this.fetchModelFromId();
            for (const pivot of this.pivots.filter((pivot) => pivot.isLoaded)) {
                const [field, fieldDesc] =
                    Object.entries(pivot.cache.getFields()).find(
                        ([fieldName, fieldDesc]) =>
                            fieldDesc.type === "many2one" &&
                            fieldDesc.relation === this.state.relation.relatedModelName
                    ) || [];
                this.state.pivotFields[pivot.id] = field
                    ? { field, type: fieldDesc.type }
                    : undefined;
            }
        }

        async fetchModelFromName() {
            if (!this.state.relation.relatedModelName) {
                this.state.relation.relatedModelID = undefined;
                return;
            }
            const result = await this.rpc({
                model: "ir.model",
                method: "search_read",
                fields: ["id", "name"],
                domain: [["model", "=", this.state.relation.relatedModelName]],
            });
            this.state.relation.relatedModelID = result[0] && result[0].id;
            if (!this.state.label) {
                this.state.label = result[0] && result[0].name;
            }
        }

        async fetchModelFromId() {
            if (!this.state.relation.relatedModelID) {
                this.state.relation.relatedModelName = undefined;
                return;
            }
            const result = await this.rpc({
                model: "ir.model",
                method: "search_read",
                fields: ["model", "name"],
                domain: [["id", "=", this.state.relation.relatedModelID]],
            });
            this.state.relation.relatedModelName = result[0] && result[0].model;
            if (!this.state.label) {
                this.state.label = result[0] && result[0].name;
            }
        }

        onSelectedField(id, ev) {
            const fieldName = ev.detail.chain[0];
            const field = this.pivots.find((pivot) => pivot.id === id).cache.getField(fieldName);
            if (field) {
                this.state.pivotFields[id] = {
                    field: fieldName,
                    type: field.type,
                };
            }
        }

        onSave() {
            this.state.saved = true;
            if (this.missingLabel || this.missingField || this.missingModel) {
                this.env.services.notification.notify({
                    type: "danger",
                    title: this.env._t("Invalid fields"),
                    sticky: false,
                });
                return;
            }
            const cmd = this.id ? "EDIT_PIVOT_FILTER" : "ADD_PIVOT_FILTER";
            const id = this.id || uuidv4();
            const filter = {
                id,
                type: this.state.type,
                label: this.state.label,
                modelName: this.state.relation.relatedModelName,
                defaultValue: this.state[this.state.type].defaultValue,
                defaultValueDisplayNames: this.state[this.state.type].displayNames,
                rangeType: this.state.date.type,
                fields: this.state.pivotFields,
            };
            const result = this.env.dispatch(cmd, { id, filter });
            if (
                result.status === "CANCELLED" &&
                result.reason === CancelledReason.DuplicatedFilterLabel
            ) {
                this.env.services.notification.notify({
                    type: "danger",
                    title: this.env._t("Duplicated Label"),
                    sticky: false,
                });
                return;
            }
            this.env.openSidePanel("GLOBAL_FILTERS_SIDE_PANEL", {});
        }

        onCancel() {
            this.env.openSidePanel("GLOBAL_FILTERS_SIDE_PANEL", {});
        }

        onValuesSelected(ev) {
            this.state.relation.defaultValue = ev.detail.value.map((record) => record.id);
            this.state.relation.displayNames = ev.detail.value.map((record) => record.display_name);
        }

        onTimeRangeChanged(ev) {
            const { year, period } = ev.detail;
            this.state.date.defaultValue = ev.detail;
        }

        onDelete() {
            if (this.id) {
                this.env.dispatch("REMOVE_PIVOT_FILTER", { id: this.id });
            }
            this.env.openSidePanel("GLOBAL_FILTERS_SIDE_PANEL", {});
        }

        onDateOptionChange(ev) {
            // TODO t-model does not work ?
            this.state.date.type = ev.target.value;
        }
    }
    FilterEditorSidePanel.template = "documents_spreadsheet.FilterEditorSidePanel";
    FilterEditorSidePanel.components = {
        FieldSelectorAdapter,
        ModelSelectorWidgetAdapter,
        TagSelectorWidgetAdapter,
        DateFilterValue,
    };

    sidePanelRegistry.add("FILTERS_SIDE_PANEL", {
        title: _t("Filter properties"),
        Body: FilterEditorSidePanel,
    });

    return FilterEditorSidePanel;
});
