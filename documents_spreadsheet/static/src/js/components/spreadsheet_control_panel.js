odoo.define("documents_spreadsheet.ControlPanel", function (require) {
    "use strict";

    const { useState } = owl.hooks;

    const ControlPanel = require("web.ControlPanel");
    const SpreadsheetName = require("documents_spreadsheet.SpreadsheetName");

    class SpreadsheetControlPanel extends ControlPanel {

        constructor() {
            super(...arguments);
            this.state = useState({
                isFavorited: false,
            });
        }

        willStart() {
          this.state.isFavorited = this.props.isFavorited;
        }

        _toggleFavorited() {
            this.state.isFavorited = !this.state.isFavorited;
            this.trigger("favorite-toggled");
        }
    }

    SpreadsheetControlPanel.template = "documents_spreadsheet.ControlPanel";
    SpreadsheetControlPanel.components = Object.assign({}, ControlPanel.components, {
        SpreadsheetName,
    });
    SpreadsheetControlPanel.props = Object.assign({}, ControlPanel.props, {
        isFavorited:{
            type: Boolean,
            optional: true
        }
    });

    return SpreadsheetControlPanel;
});
