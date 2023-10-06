odoo.define("documents_spreadsheet.test_utils", function (require) {
    "use strict";
    const testUtils = require("web.test_utils");
    const PivotView = require("web.PivotView");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");

    const { createActionManager, nextTick, createView } = testUtils;
    const { toCartesian } = spreadsheet.helpers;

    /*
        This function creates a spreadsheet (or a template) and returns the action manager, the environment and the model
        ?viewData.spreadsheetAction is a string used to define the tag of the first action to be executed
        for example 'action_open_spreadsheet' to open the spreadsheet or 'action_open_template' to open the template
    */
    async function createSpreadsheetActionManager(viewData) {
        const { data, debug, id, spreadsheetAction } = viewData;
        const actionManager = await createActionManager({
            debug,
            data,
            mockRPC: viewData.mockRPC,
            intercepts: viewData.intercepts || {},
            services: viewData.services || {},
            archs: viewData.archs || {},
        });
        if (spreadsheetAction) {
            await actionManager.doAction({
                type: "ir.actions.client",
                tag: spreadsheetAction,
                params: {
                    active_id: id,
                },
            })
        }
        await nextTick();
        const spreadSheetComponent = actionManager.getCurrentController().widget
            .spreadsheetComponent.componentRef.comp;
        const oSpreadsheetComponent = spreadSheetComponent.spreadsheet.comp
        const model = oSpreadsheetComponent.model;
        const env = Object.assign(spreadSheetComponent.env, {
            getters: model.getters,
            dispatch: model.dispatch,
            services: model.config.evalContext.env.services,
            openSidePanel: oSpreadsheetComponent.openSidePanel.bind(oSpreadsheetComponent),
        });
        return [actionManager, model, env];
    }

    async function createSpreadsheetFromPivot(pivotView) {
        const { data, debug } = pivotView;
        const pivot = await createView(
            Object.assign({ View: PivotView }, pivotView)
        );
        const documents = data["documents.document"].records;
        const id = Math.max(...documents.map((d) => d.id)) + 1;
        documents.push({
            id,
            name: "pivot spreadsheet",
            raw: await pivot._getSpreadsheetData(),
        });
        pivot.destroy();
        const [actionManager, model, env] = await createSpreadsheetActionManager({
            debug,
            data,
            id,
            spreadsheetAction: "action_open_spreadsheet",
            mockRPC: pivotView.mockRPC,
            intercepts: pivotView.intercepts || {},
            services: pivotView.services || {},
            archs: pivotView.archs || {},
        });
        return [actionManager, model, env];
    }

    function setCellContent(model, xc, content, sheet = model.getters.getActiveSheet()){
        const [col, row] = toCartesian(xc);
        return model.dispatch("UPDATE_CELL", { col, row, sheet, content });
    }

    function getCellValue(model, xc) {
        const [col, row] = toCartesian(xc);
        return model.getters.getCell(col, row).value
    }

    return {
        createSpreadsheetActionManager,
        createSpreadsheetFromPivot,
        setCellContent,
        getCellValue,
    };
});
