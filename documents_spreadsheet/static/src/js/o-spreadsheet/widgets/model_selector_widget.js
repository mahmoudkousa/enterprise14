odoo.define("documents_spreadsheet.model_selector_widget", function (require) {
    const core = require("web.core");
    const { ComponentAdapter } = require("web.OwlCompatibility");
    const { FieldMany2One } = require("web.relational_fields");
    const StandaloneFieldManagerMixin = require("web.StandaloneFieldManagerMixin");
    const Widget = require("web.Widget");

    const QWeb = core.qweb;

    /**
     * This widget is used in the global filters to select a ir.model record.
     * It uses a FieldMany2One widget.
     */
    const ModelSelectorWidget = Widget.extend(StandaloneFieldManagerMixin, {
        /**
         * @constructor
         */
        init: function (parent, modelID, models) {
            this._super.apply(this, arguments);
            StandaloneFieldManagerMixin.init.call(this);
            this.widget = undefined;
            this.value = modelID;
            this.models = models;
        },
        /**
         * @override
         */
        willStart: async function () {
            await this._super.apply(this, arguments);
            await this._createM2OWidget();
        },
        /**
         * @override
         */
        start: function () {
            const $content = $(QWeb.render("documents_spreadsheet.ModelSelector", {}));
            this.$el.append($content);
            this.widget.appendTo($content);
            return this._super.apply(this, arguments);
        },

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * @override
         */
        _confirmChange: async function () {
            const result = await StandaloneFieldManagerMixin._confirmChange.apply(this, arguments);
            this.trigger_up("model_selected", { value: this.widget.value.res_id });
            return result;
        },
        /**
         * Create a record for ir.model model and a FieldMany2One linked to this
         * record
         */
        _createM2OWidget: async function () {
            const recordID = await this.model.makeRecord("ir.model", [
                {
                    name: "ir.model",
                    relation: "ir.model",
                    type: "many2one",
                    value: this.value,
                    domain: [["model", "in", this.models]],
                },
            ]);
            this.widget = new FieldMany2One(this, "ir.model", this.model.get(recordID), {
                mode: "edit",
                attrs: {
                    can_create: false,
                    can_write: false,
                    options: { no_open: true },
                },
            });
            this._registerWidget(recordID, "ir.model", this.widget);
        },
    });

    class ModelSelectorWidgetAdapter extends ComponentAdapter {
        /**
         * @override
         */
        get widgetArgs() {
            return [this.props.modelID, this.props.models];
        }
    }

    return { ModelSelectorWidget, ModelSelectorWidgetAdapter };
});
