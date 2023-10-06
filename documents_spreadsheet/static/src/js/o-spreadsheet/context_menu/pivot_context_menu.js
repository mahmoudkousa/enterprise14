odoo.define("documents_spreadsheet.pivot_context_menu", function (require) {
    "use strict";

    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const { fetchCache, pivotFormulaRegex,waitForIdle } = require("documents_spreadsheet.pivot_utils");

    const _t = core._t;
    const cellMenuRegistry = spreadsheet.registries.cellMenuRegistry;
    const { toXC, toCartesian } = spreadsheet.helpers;
    const createFullMenuItem = spreadsheet.helpers.createFullMenuItem;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    cellMenuRegistry
        .add("reinsert_pivot", {
            name: _t("Re-insert pivot"),
            sequence: 122,
            children: (env) => Object.values(env.getters.getPivots())
                .map((pivot, index) => (createFullMenuItem(`reinsert_pivot_${pivot.id}`, {
                    name: `${pivot.cache && pivot.cache.getModelLabel() || pivot.model} (#${pivot.id})`,
                    sequence: index,
                    action: async (env) => {
                        // We need to fetch the cache without the global filters,
                        // to get the full pivot structure.
                        await fetchCache(pivot, env.services.rpc, {
                            dataOnly: true,
                            initialDomain: true,
                            force: true,
                        });
                        const zone = env.getters.getSelectedZone();
                        env.dispatch("REBUILD_PIVOT", {
                            id: pivot.id,
                            anchor: [zone.left, zone.top],
                        });
                        if (env.getters.getActiveFilterCount()) {
                            await fetchCache(pivot, env.services.rpc, {
                                dataOnly: true,
                                initialDomain: false,
                                force: true,
                            });
                        }
                        env.dispatch("EVALUATE_CELLS");
                    }
                })),
            ),
            isVisible: (env) => env.getters.getPivots().length,
        })
        .add("insert_pivot_cell", {
            name: _t("Insert pivot cell"),
            sequence: 123,
            children: (env) => Object.values(env.getters.getPivots())
                .map((pivot, index) => (createFullMenuItem(`insert_pivot_cell_${pivot.id}`, {
                    name: `${pivot.cache && pivot.cache.getModelLabel() || pivot.model} (#${pivot.id})`,
                    sequence: index,
                    action: async (env) => {
                        const xc = env.getters.getMainCell(toXC(...env.getters.getPosition()));
                        const [ col, row ] = toCartesian(xc);
                        const insertPivotValueCallback = (formula) => {
                            env.dispatch("UPDATE_CELL", { sheet: env.getters.getActiveSheet(), col, row, content: formula });
                        }

                        await fetchCache(pivot, env.services.rpc, { dataOnly: true, force: true });
                        env.dispatch("EVALUATE_CELLS");
                        // Here we need to wait for every cells of the sheet are
                        // computed, in order to ensure that the cache of missing
                        // values is correctly filled
                        await waitForIdle(env.getters);

                        env.openPivotDialog({ pivotId: pivot.id, insertPivotValueCallback });
                    },
                })),
            ),
            isVisible: (env) => env.getters.getPivots().length,
            separator: true,
        })
        .add("pivot_properties", {
            name: _t("Pivot properties"),
            sequence: 121,
            action(env) {
                env.dispatch("SELECT_PIVOT", { cell: env.getters.getActiveCell() });
                const pivot = env.getters.getSelectedPivot();
                if (pivot) {
                    env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivot });
                }
            },
            isVisible: (env) => {
                const cell = env.getters.getActiveCell();
                return cell && cell.type === "formula" && cell.content.match(pivotFormulaRegex);
            }
        });
});
