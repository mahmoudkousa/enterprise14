odoo.define("documents_spreadsheet.menu_item_registry", function (require) {
    "use strict";

    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const core = require("web.core");

    const _t = core._t;
    const topbarMenuRegistry = spreadsheet.registries.topbarMenuRegistry;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    topbarMenuRegistry.add("file", { name: _t("File"), sequence: 10 });
    topbarMenuRegistry.addChild("new_sheet", ["file"], {
        name: _t("New"),
        sequence: 10,
        action: (env) => env.newSpreadsheet(),
    });
    topbarMenuRegistry.addChild("make_copy", ["file"], {
        name: _t("Make a copy"),
        sequence: 20,
        action: (env) => env.makeCopy(),
    });
    topbarMenuRegistry.addChild("save", ["file"], {
        name: _t("Save"),
        sequence: 30,
        action: (env) => env.saveData(),
    });
    topbarMenuRegistry.addChild("save_as_template", ["file"], {
        name: _t("Save as Template"),
        sequence: 40,
        action: (env) => env.saveAsTemplate(),
    });
});
