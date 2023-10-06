odoo.define("documents_spreadsheet.filter_component", function (require) {

    const { Component } = owl;
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const Menu = spreadsheet.Menu;
    const { topbarComponentRegistry } = spreadsheet.registries;

    class FilterComponent extends Component {
        constructor() {
            super(...arguments);
        }

        get activeFilter() {
            return this.env.getters.getActiveFilterCount();
        }

        toggleDropdown() {
            this.env.toggleSidePanel("GLOBAL_FILTERS_SIDE_PANEL");
        }
    }

    FilterComponent.template = "documents_spreadsheet.FilterComponent";

    FilterComponent.components = {
        Menu,
    };

    topbarComponentRegistry.add("filter_component", {
        component: FilterComponent,
        isVisible: (env) => env.getters.getPivots().length,
    });

    return { FilterComponent };
});
