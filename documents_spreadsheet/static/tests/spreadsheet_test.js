odoo.define("web.spreadsheet_tests", function (require) {
    "use strict";

    const testUtils = require("web.test_utils");
    const NotificationService = require('web.NotificationService');
    const spreadsheetUtils = require("documents_spreadsheet.test_utils")

    const { createSpreadsheetFromPivot } = spreadsheetUtils;

    const { createActionManager, fields, nextTick, dom } = testUtils;
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const cellMenuRegistry = spreadsheet.registries.cellMenuRegistry;
    const toCartesian = spreadsheet.helpers.toCartesian;
    const { Model } = spreadsheet;

    function getCellValue(model, xc) {
        return model.getters.getCell(...toCartesian(xc)).value;
    }

    QUnit.module("Spreadsheet Client Action", {
        beforeEach: function () {
            this.data = {
                "documents.document": {
                    fields: {
                        name: { string: "Name", type: "char" },
                        raw: { string: "Data", type: "text" },
                        thumbnail: { string: "Thumbnail", type: "text" },
                        favorited_ids: { string: "Name", type: "many2many" },
                        is_favorited: { string: "Name", type: "boolean" },
                    },
                    records: [
                        { id: 1, name: "My spreadsheet", raw: "{}", is_favorited: false },
                        { id: 2, name: "", raw: "{}", is_favorited: true },
                    ],
                },
                "ir.model": {
                    fields: {
                        name: { string: "Model Name", type: "char" },
                        model: { string: "Model", type: "char" },
                    },
                    records: [
                        {
                            id: 37,
                            name: "Product",
                            model: "product",
                        },
                        {
                            id: 40,
                            name: "partner",
                            model: "partner",
                        },
                    ],
                },
                "partner": {
                    fields: {
                        foo: {
                            string: "Foo",
                            type: "integer",
                            searchable: true,
                            group_operator: "sum",
                        },
                        bar: {
                            string: "Bar",
                            type: "integer",
                            searchable: true,
                            group_operator: "sum",
                        },
                        product: {
                            relation: "product",
                            string: "Product",
                            type: "many2one",
                        },
                        probability: {
                            string: "Probability",
                            type: "integer",
                            searchable: true,
                            group_operator: "avg",
                        },
                    },
                    records: [
                        {
                            id: 1,
                            foo: 12,
                            bar: 110,
                            product: 37,
                            probability: 10,
                        },
                        {
                            id: 2,
                            foo: 1,
                            bar: 110,
                            product: 41,
                            probability: 11,
                        },
                    ],
                },
                product: {
                    fields: {
                        name: { string: "Product Name", type: "char" },
                    },
                    records: [
                        {
                            id: 37,
                            display_name: "xphone",
                        },
                        {
                            id: 41,
                            display_name: "xpad",
                        },
                    ],
                },
            };
        },
    }, function () {
        QUnit.module("Spreadsheet control panel");

        QUnit.test("breadcrumb is rendered in control panel", async function (assert) {
            assert.expect(3);
            const actionManager = await createActionManager({
                actions: [{
                    id: 1,
                    name: "Documents",
                    res_model: "documents.document",
                    type: "ir.actions.act_window",
                    views: [[false, "list"]],
                }],
                archs: {
                    "documents.document,false,list": '<tree><field name="name"/></tree>',
                    "documents.document,false,search": "<search></search>",
                },
                data: this.data,
            });
            await actionManager.doAction(1);
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 1,
              },
            });
            const breadcrumbItems = actionManager.el.querySelectorAll(".breadcrumb-item");
            assert.equal(breadcrumbItems[0].querySelector("a").innerText, "Documents",
                "It should display the breadcrumb");
            assert.equal(breadcrumbItems[1].querySelector("input").value, "My spreadsheet",
                "It should display the spreadsheet title");
            assert.ok(breadcrumbItems[1].querySelector(".o_spreadsheet_favorite"),
                "It should display the favorite toggle button");
            actionManager.destroy();
        });

        QUnit.test("untitled speadsheet", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            assert.equal(input.value, "", "It should be empty");
            assert.equal(input.placeholder, "Untitled spreadsheet", "It should display a placeholder");
            await nextTick();
            actionManager.destroy();
        });

        QUnit.test("input width changes when content changes", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "My");
            let width = input.offsetWidth;
            await fields.editInput(input, "My title");
            assert.ok(width < input.offsetWidth, "It should have grown to fit content");
            width = input.offsetWidth;
            await fields.editInput(input, "");
            assert.ok(width < input.offsetWidth, "It should have the size of the placeholder text");
            actionManager.destroy();
        });

        QUnit.test("changing the input saves the name", async function (assert) {
            assert.expect(4);
            const actionManager = await createActionManager({
                data: this.data,
                mockRPC: async function (route, args) {
                    if (args.method === "write" && args.model === "documents.document") {
                        assert.step("spreadsheet_name_saved");
                        assert.deepEqual(args.args[0], [2], "It should write the correct document");
                        assert.deepEqual(args.args[1], { name: "My spreadsheet" }, "It should write the name");
                        return true;
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editAndTrigger(input, "My spreadsheet", ["change"]);
            assert.verifySteps(["spreadsheet_name_saved"]);
            actionManager.destroy();
        });

        QUnit.test("user with readonly access cannot save spreadsheet", async function (assert) {
            assert.expect(5);
            const actionManager = await createActionManager({
                data: this.data,
                mockRPC: async function (route, args) {
                    if (args.method === "check_spreadsheet_access" && args.model === "documents.document") {
                        assert.step("check_spreadsheet_access");
                        assert.deepEqual(args.args[0], 1, "It should write the correct document");
                        assert.deepEqual(args.args[1], 'write', "We are checking for write access");
                        return false;
                    }
                    return this._super.apply(this, arguments);
                },
                services: {
                    notification: NotificationService.extend({
                        notify: function () {
                            assert.step("notification");
                        }
                    }),
                },
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 1,
              },
            });
            await nextTick();
            assert.verifySteps(["check_spreadsheet_access", "notification"]);
            actionManager.destroy();
        });

        QUnit.test("trailing white spaces are trimed", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "My spreadsheet  ");
            const width = input.offsetWidth;
            await dom.triggerEvent(input, "change");
            assert.equal(input.value, "My spreadsheet", "It should not have trailing white spaces");
            assert.ok(width > input.offsetWidth, "It should have resized");
            actionManager.destroy();
        });

        QUnit.test("focus sets the placeholder as value and select it", async function (assert) {
            assert.expect(4);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            assert.equal(input.value, "", "It should be empty");
            await dom.triggerEvent(input, "focus");
            assert.equal(input.value, "Untitled spreadsheet", "Placeholder should have become the input value");
            assert.equal(input.selectionStart, 0, "It should have selected the value");
            assert.equal(input.selectionEnd, input.value.length, "It should have selected the value");
            actionManager.destroy();
        });

        QUnit.test("only white spaces show the placeholder", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "  ");
            const width = input.offsetWidth;
            await dom.triggerEvent(input, "change");
            assert.equal(input.value, "", "It should be empty");
            assert.ok(width < input.offsetWidth, "It should have the placeholder size");
            actionManager.destroy();
        });

        QUnit.test("toggle favorite", async function (assert) {
            assert.expect(5);
            const actionManager = await createActionManager({
                data: this.data,
                mockRPC: async function (route, args) {
                    if (args.method === "toggle_favorited" && args.model === "documents.document") {
                        assert.step("favorite_toggled");
                        assert.deepEqual(args.args[0], [1], "It should write the correct document");
                        return;
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await actionManager.doAction({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: 1,
                },
            });
            assert.containsNone(actionManager, ".favorite_button_enabled");
            const favorite = actionManager.el.querySelector(".o_spreadsheet_favorite");
            await dom.click(favorite);
            assert.containsOnce(actionManager, ".favorite_button_enabled");
            assert.verifySteps(["favorite_toggled"]);
            actionManager.destroy();
        });

        QUnit.test("already favorited", async function (assert) {
            assert.expect(1);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: 2,
                },
            });
            assert.containsOnce(actionManager, ".favorite_button_enabled", "It should already be favorited");
            actionManager.destroy();
        });

        QUnit.test("Spreadsheet action is named in breadcrumb", async function (assert) {
            assert.expect(2);
            const arch = `
                <pivot string="Partners">
                    <field name="bar" type="col"/>
                    <field name="foo" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`
            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch,
                archs: {
                    "partner,false,pivot": arch,
                    "partner,false,search": `<search/>`,
                },
            });
            await actionManager.doAction({
                name: 'Partner',
                res_model: 'partner',
                type: 'ir.actions.act_window',
                views: [[false, 'pivot']],
            });
            await nextTick();
            const items = actionManager.el.querySelectorAll(".breadcrumb-item");
            const [breadcrumb1, breadcrumb2] = Array.from(items).map((item) => item.innerText);
            assert.equal(breadcrumb1, "Spreadsheet");
            assert.equal(breadcrumb2, "Partner");
            actionManager.destroy();
        });

        QUnit.module("Spreadsheet");

        QUnit.test("relational PIVOT.HEADER with missing id", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="product" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("UPDATE_CELL", {
                col: 4,
                row: 9,
                content: `=PIVOT.HEADER("1", "product", "1111111")`,
                sheet: model.getters.getActiveSheet(),
            });
            await nextTick();
            assert.ok(model.getters.getCell(4, 9).error);

            // This is obviously not the desired error message. It happens because Odoo
            // RPC errors do not have a simple string message but an object with the
            // error details.
            // Will be fixed with task 2393876
            assert.equal(model.getters.getCell(4, 9).error, "[object Object]");
            actionManager.destroy();
        });

        QUnit.test("relational PIVOT.HEADER with undefined id", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("UPDATE_CELL", {
                col: 4,
                row: 9,
                content: `=PIVOT.HEADER("1", "product", A25)`,
                sheet: model.getters.getActiveSheet(),
            });
            assert.equal(model.getters.getCell(0, 24), null, "the cell should be empty");
            await nextTick();
            assert.equal(model.getters.getCell(4, 9).value, "");
            actionManager.destroy();
        });

        QUnit.test("Reinsert a pivot", async function (assert) {
            assert.expect(1);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(4, 9).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a pivot formula");
            actionManager.destroy();
        });

        QUnit.test("Reinsert a pivot in a too small sheet", async function (assert) {
            assert.expect(3);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("CREATE_SHEET", { cols: 1, rows: 1, activate: true, id: "111" });
            model.dispatch("SELECT_CELL", { col: 0, row: 0 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getNumberCols(model.getters.getActiveSheet()), 5);
            assert.equal(model.getters.getNumberRows(model.getters.getActiveSheet()), 5);
            assert.equal(model.getters.getCell(1, 2).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a pivot formula");
            actionManager.destroy();
        });

        QUnit.test("Reinsert a pivot with new data", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            this.data.partner.records = [...this.data.partner.records, {
                id: 3,
                foo: 1,
                bar: 7, // <- new row value in the pivot
                probability: 15,
                name: "name",
                display_name: "name",
            }];
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(4, 9).content, `=PIVOT("1","probability","bar","7","foo","1")`,
                "It should contain a pivot formula");
            assert.equal(model.getters.getCell(4, 10).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a new row");
            actionManager.destroy();
        });

        QUnit.test("Reinsert a pivot with an updated record", async function (assert) {
            assert.expect(6);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            assert.equal(/*A3*/model.getters.getCell(0, 2).value, 110,);
            assert.equal(/*B3*/model.getters.getCell(1, 2).value, 11);
            assert.equal(/*C3*/model.getters.getCell(2, 2).value, 10);
             // previously in group bar=110, now it's in a new group bar=99
            this.data.partner.records[0].bar = 99;
            this.data.partner.records[1].bar = 99;
            // updated measures
            this.data.partner.records[0].probability = 88;
            this.data.partner.records[1].probability = 77;
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            await nextTick();
            assert.equal(/*A3*/model.getters.getCell(0, 2).value, 99, "The header should have been updated");
            assert.equal(/*B3*/model.getters.getCell(1, 2).value, 77, "The value should have been updated");
            assert.equal(/*C3*/model.getters.getCell(2, 2).value, 88, "The value should have been updated");
            actionManager.destroy();
        });

        QUnit.test("Keep applying filter when pivot is re-inserted", async function (assert) {
            assert.expect(4);
            const [ actionManager, model, env ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                    <pivot>
                        <field name="bar" type="col"/>
                        <field name="product" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>
                `,
            });
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "relation",
                    label: "Filter",
                    fields: {
                        1: {
                            field: "product",
                            type: "many2one",
                        }
                    },
                }
            });
            await nextTick();
            model.dispatch("SET_PIVOT_FILTER_VALUE", {
                id: "42",
                value: [41],
            });
            await nextTick();
            assert.equal(/*B3*/model.getters.getCell(1, 2).value, "", "The value should have been filtered");
            assert.equal(/*C3*/model.getters.getCell(2, 2).value, "", "The value should have been filtered");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            await nextTick();
            assert.equal(/*B3*/model.getters.getCell(1, 2).value, "", "The value should still be filtered");
            assert.equal(/*C3*/model.getters.getCell(2, 2).value, "", "The value should still be filtered");
            actionManager.destroy();
        });

        QUnit.test("undo pivot reinsert", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(4, 9).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a pivot formula");
            model.dispatch("UNDO");
            assert.notOk(model.getters.getCell(4, 9), "It should have removed the re-inserted pivot");
            actionManager.destroy();
        });

        QUnit.test("reinsert pivot with anchor on merge but not top left", async function (assert) {
            assert.expect(3);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            assert.equal(model.getters.getCell(1, 1).content, `=PIVOT.HEADER("1","foo","1","measure","probability")`,
                "It should contain a pivot formula");
            model.dispatch("SELECT_CELL", { col: 0, row: 1 }); // A1 and A2 are merged; select A2
            assert.ok(model.getters.isInMerge("A2"));
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(1, 1).content, `=PIVOT.HEADER("1","foo","1","measure","probability")`,
                "It should contain a pivot formula");
            actionManager.destroy();
        });

        QUnit.test("Verify pivot measures are correctly computed :)", async function (assert) {
            assert.expect(4);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            assert.equal(model.getters.getCell(1, 2).value, 11);
            assert.equal(model.getters.getCell(2, 2).value, 10);
            assert.equal(model.getters.getCell(1, 3).value, 11);
            assert.equal(model.getters.getCell(2, 3).value, 10);
            actionManager.destroy();
        });

        QUnit.test("Open pivot properties properties", async function (assert) {
            assert.expect(14);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                    <pivot display_quantity="true">
                        <field name="foo" type="col"/>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
            });
            const A3 = model.getters.getCell(0, 2);
            model.dispatch("SELECT_PIVOT", { cell: A3 });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", {
                pivot: model.getters.getSelectedPivot(),
            })
            await nextTick();
            const title = actionManager.el.querySelector(".o-sidePanelTitle").innerText;
            assert.equal(title, "Pivot properties");

            const sections = actionManager.el.querySelectorAll(".o_side_panel_section");
            assert.equal(sections.length, 5, "it should have 5 sections");
            const [pivotName, pivotModel, domain, dimensions, measures] = sections;

            assert.equal(pivotName.children[0].innerText, "Pivot name");
            assert.equal(pivotName.children[1].innerText, "partner (#1)");

            assert.equal(pivotModel.children[0].innerText, "Model");
            assert.equal(pivotModel.children[1].innerText, "partner (partner)");

            assert.equal(domain.children[0].innerText, "Domain");
            assert.equal(domain.children[1].innerText, "Match all records");

            assert.equal(measures.children[0].innerText, "Measures");
            assert.equal(measures.children[1].innerText, "Count");
            assert.equal(measures.children[2].innerText, "Probability");

            assert.equal(dimensions.children[0].innerText, "Dimensions");
            assert.equal(dimensions.children[1].innerText, "Bar");
            assert.equal(dimensions.children[2].innerText, "Foo");
            actionManager.destroy();
        });

        QUnit.test("Open pivot properties properties with non-loaded field", async function (assert) {
            assert.expect(1);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                    <pivot display_quantity="true">
                        <field name="foo" type="col"/>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
            });
            const pivot = model.getters.getPivot("1");
            pivot.measures.push({
                field: "non-existing",
                operator: "sum",
            })
            const A3 = model.getters.getCell(0, 2);
            model.dispatch("SELECT_PIVOT", { cell: A3 });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", {
                pivot: model.getters.getSelectedPivot(),
            })
            await nextTick();
            const sections = actionManager.el.querySelectorAll(".o_side_panel_section");
            const measures = sections[4];
            assert.equal(measures.children[3].innerText, "non-existing");

            actionManager.destroy();
        });

        QUnit.test("Can refresh the pivot from the pivot properties panel", async function (assert) {
            assert.expect(1);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                    <pivot display_quantity="true">
                        <field name="foo" type="col"/>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
            });
            const A3 = model.getters.getCell(0, 2);
            model.dispatch("SELECT_PIVOT", { cell: A3 });
            const pivot = model.getters.getSelectedPivot();
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivot })
            this.data.partner.records.push({
                id: 1,
                foo: 12,
                bar: 110,
                product: 37,
                probability: 10,
            },)
            await nextTick();
            await dom.click(actionManager.el.querySelector(".o_refresh_measures"));
            await nextTick();
            assert.equal(getCellValue(model, "D3"), 2);
            actionManager.destroy();
        });

        QUnit.test("Pivot cache is correctly copied", async function (assert) {
            assert.expect(18);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="product" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const { cache } = model.getters.getPivot(1);
            const newCache = cache.withLabel("product", 37, "My amazing product");
            assert.equal(newCache.getRows(), cache.getRows());
            assert.equal(newCache.getRowCount(), cache.getRowCount());
            assert.equal(newCache.getColLevelIdentifier(0), cache.getColLevelIdentifier(0));
            assert.equal(newCache.getField("product"), cache.getField("product"));
            assert.equal(cache.getGroupLabel("product", 37), "xphone");
            assert.equal(newCache.getGroupLabel("product", 37), "My amazing product");
            assert.ok(newCache.isGroupLabelLoaded("product", 37));
            assert.ok(cache.isGroupLabelLoaded("product", 37));
            assert.deepEqual(
                newCache.isGroupedByDate(["product"]),
                cache.isGroupedByDate(["product"])
            );
            assert.equal(newCache.getMeasureName(0), cache.getMeasureName(0));
            assert.equal(newCache.getColGroupHierarchy(0, 1), cache.getColGroupHierarchy(0, 1));
            assert.equal(newCache.getRowValues(0), cache.getRowValues(0));
            assert.equal(newCache.getColGroupByLevels(), cache.getColGroupByLevels());
            assert.equal(newCache.getTopHeaderCount(), cache.getTopHeaderCount());
            assert.equal(newCache.getTopGroupIndex(), cache.getTopGroupIndex());
            assert.equal(newCache.getRowIndex("bar"), cache.getRowIndex("bar"));
            assert.deepEqual(newCache.getFieldValues("product"), cache.getFieldValues("product"));
            assert.deepEqual(newCache.getColumnValues(0), cache.getColumnValues(0));
            actionManager.destroy();
        });

        QUnit.test("Check pivot measures with m2o field", async function (assert) {
            assert.expect(3);
            this.data.partner.records.push(
                {id: 3, foo: 12, bar: 110, product: 37, probability: 50},
                {id: 4, foo: 18, bar: 110, product: 41, probability: 12},
                {id: 5, foo: 18, bar: 110, product: 37, probability: 13},
                {id: 6, foo: 18, bar: 110, product: 37, probability: 14},
            )
            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="product" type="measure"/>
                </pivot>`,
            });
            assert.equal(model.getters.getCell(1, 2).value, 1, "[Cell B3] There is one distinct product for 'foo - 1' and 'bar - 110'");
            assert.equal(model.getters.getCell(2, 2).value, 1, "[Cell C3] There is one distinct product for 'foo - 12' and 'bar - 110'");
            assert.equal(model.getters.getCell(3, 2).value, 2, "[Cell D3] There are two distinct products for 'foo - 18' and 'bar - 110'");
            actionManager.destroy();
        });


        QUnit.module("Global filters panel");

        QUnit.test("Simple display", async function (assert) {
            assert.expect(6);

            const [ actionManager ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            assert.notOk(actionManager.el.querySelector(".o_spreadsheet_global_filters_side_panel"));
            const searchIcon = actionManager.el.querySelector(".o_topbar_filter_icon");
            await dom.click(searchIcon);
            assert.ok(actionManager.el.querySelector(".o_spreadsheet_global_filters_side_panel"));
            const items = actionManager.el.querySelectorAll(".o_spreadsheet_global_filters_side_panel .o-sidePanelButton");
            assert.equal(items.length, 3);
            assert.ok(items[0].classList.contains("o_global_filter_new_time"));
            assert.ok(items[1].classList.contains("o_global_filter_new_relation"));
            assert.ok(items[2].classList.contains("o_global_filter_new_text"));
            actionManager.destroy();
        });

        QUnit.test("Display with an existing 'Date' global filter", async function (assert) {
            assert.expect(4);

            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const label = "This year";
            model.dispatch("ADD_PIVOT_FILTER", { filter: { id: "42", type: "date", label, fields: {}, defaultValue: { year:"this_year" }}});
            const searchIcon = actionManager.el.querySelector(".o_topbar_filter_icon");
            await dom.click(searchIcon);
            const items = actionManager.el.querySelectorAll(".o_spreadsheet_global_filters_side_panel .o_side_panel_section");
            assert.equal(items.length, 2);
            const labelElement = items[0].querySelector(".o_side_panel_filter_label");
            assert.equal(labelElement.innerText, label);
            await dom.click(items[0].querySelector(".o_side_panel_filter_icon"));
            assert.ok(actionManager.el.querySelectorAll(".o_spreadsheet_filter_editor_side_panel"));
            assert.equal(actionManager.el.querySelector(".o_global_filter_label").value, label);
            actionManager.destroy();
        });


        QUnit.test("Create a new global filter", async function (assert) {
            assert.expect(4);

            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>
                `,
            });
            const searchIcon = actionManager.el.querySelector(".o_topbar_filter_icon");
            await dom.click(searchIcon);
            const newText = actionManager.el.querySelector(".o_global_filter_new_text");
            await dom.click(newText);
            assert.equal(actionManager.el.querySelectorAll(".o-sidePanel").length, 1);
            const input = actionManager.el.querySelector(".o_global_filter_label");
            await fields.editInput(input, "My Label");
            const value = actionManager.el.querySelector(".o_global_filter_default_value");
            await fields.editInput(value, "Default Value");
            // Can't make it work with the DOM API :(
            // await dom.triggerEvent(actionManager.el.querySelector(".o_field_selector_value"), "focusin");
            $(actionManager.el.querySelector(".o_field_selector_value")).focusin();
            await dom.click(actionManager.el.querySelector(".o_field_selector_select_button"));
            const save = actionManager.el.querySelector(".o_spreadsheet_filter_editor_side_panel .o_global_filter_save");
            await dom.click(save);
            assert.equal(actionManager.el.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length, 1);
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "My Label");
            assert.equal(globalFilter.defaultValue, "Default Value");
            actionManager.destroy();
        });

        QUnit.test("Create a new relational global filter", async function (assert) {
            assert.expect(4);

            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const searchIcon = actionManager.el.querySelector(".o_topbar_filter_icon");
            await dom.click(searchIcon);
            const newRelation = actionManager.el.querySelector(".o_global_filter_new_relation");
            await dom.click(newRelation);
            let selector = `.o_field_many2one[name="ir.model"] input`;
            await dom.click(actionManager.el.querySelector(selector));
            let $dropdown = $(selector).autocomplete('widget');
            let $target = $dropdown.find(`li:contains(Product)`).first();
            await dom.click($target);

            let save = actionManager.el.querySelector(".o_spreadsheet_filter_editor_side_panel .o_global_filter_save");
            await dom.click(save);
            assert.equal(actionManager.el.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length, 1);
            let globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "Product");
            assert.deepEqual(globalFilter.defaultValue, []);
            assert.deepEqual(globalFilter.fields[1], { field: "product", type: "many2one" });

            actionManager.destroy();
        });


        QUnit.test("Display with an existing 'Relation' global filter", async function (assert) {
            assert.expect(8);

            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const label = "MyFoo";
            model.dispatch("ADD_PIVOT", {
                anchor: [15, 15],
                pivot: { ...model.getters.getPivots()[0] }
            })
            const filter = {
                id: "42",
                type: "relation",
                modelName: "product",
                label,
                fields: {
                    1: { type:"many2one", field:"product" },
                    2: { type:"many2one", field:"product" }
                },
                defaultValue: [],
            }
            model.dispatch("ADD_PIVOT_FILTER", { filter });
            const searchIcon = actionManager.el.querySelector(".o_topbar_filter_icon");
            await dom.click(searchIcon);
            const items = actionManager.el.querySelectorAll(".o_spreadsheet_global_filters_side_panel .o_side_panel_section");
            assert.equal(items.length, 2);
            const labelElement = items[0].querySelector(".o_side_panel_filter_label");
            assert.equal(labelElement.innerText, label);
            await dom.click(items[0].querySelector(".o_side_panel_filter_icon"));
            assert.ok(actionManager.el.querySelectorAll(".o_spreadsheet_filter_editor_side_panel"));
            assert.equal(actionManager.el.querySelector(".o_global_filter_label").value, label);
            assert.equal(actionManager.el.querySelector(`.o_field_many2one[name="ir.model"] input`).value, "Product");
            const fieldsMatchingElements = actionManager.el.querySelectorAll("span.o_field_selector_chain_part")
            assert.equal(fieldsMatchingElements.length, 2);
            assert.equal(fieldsMatchingElements[0].innerText, "Product");
            assert.equal(fieldsMatchingElements[1].innerText, "Product");
            actionManager.destroy();
        });

        QUnit.test("Prevent selection of a Field Matching before the Related model", async function (assert) {
            assert.expect(2);

            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
                mockRPC: async function (route, args) {
                    if (args.method === "search_read" && args.model === "ir.model") {
                        return [{ name: "Product", model: "product" }];
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await dom.click(".o_topbar_filter_icon");
            await dom.click(".o_global_filter_new_relation");
            let relatedModelSelector = `.o_field_many2one[name="ir.model"] input`;
            let fieldMatchingSelector = `.o_pivot_field_matching`;
            assert.containsNone(actionManager.el, fieldMatchingSelector);
            await dom.click(actionManager.el.querySelector(relatedModelSelector));
            let $dropdown = $(relatedModelSelector).autocomplete('widget');
            let $target = $dropdown.find(`li:contains(Product)`).first();
            await dom.click($target);
            assert.containsOnce(actionManager.el, fieldMatchingSelector);
            actionManager.destroy();
        });

        QUnit.test("Only related models can be selected", async function (assert) {
            assert.expect(2);
            this.data["ir.model"].records.push({
                id: 36,
                name: "Apple",
                model: "apple",
            }, {
                id: 35,
                name: "Document",
                model: "documents.document",
            })
            this.data["partner"].fields.document = {
                relation: "documents.document",
                string: "Document",
                type: "many2one",
            };
            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const searchIcon = actionManager.el.querySelector(".o_topbar_filter_icon");
            await dom.click(searchIcon);
            const newRelation = actionManager.el.querySelector(".o_global_filter_new_relation");
            await dom.click(newRelation);
            const selector = `.o_field_many2one[name="ir.model"] input`;
            await dom.click(actionManager.el.querySelector(selector));
            const $dropdown = $(selector).autocomplete('widget');
            const [model1, model2] = $dropdown.find(`li`);
            assert.equal(model1.innerText, "Product")
            assert.equal(model2.innerText, "Document")
            actionManager.destroy();
        });

        QUnit.test("Edit an existing global filter", async function (assert) {
            assert.expect(4);

            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const label = "This year";
            const defaultValue = "value";
            model.dispatch("ADD_PIVOT_FILTER", { filter: { id: "42", type: "text", label, defaultValue, fields: {}}});
            const searchIcon = actionManager.el.querySelector(".o_topbar_filter_icon");
            await dom.click(searchIcon);
            const editFilter = actionManager.el.querySelectorAll(".o_side_panel_filter_icon");
            await dom.click(editFilter);
            assert.equal(actionManager.el.querySelectorAll(".o-sidePanel").length, 1);
            const input = actionManager.el.querySelector(".o_global_filter_label");
            assert.equal(input.value, label);
            const value = actionManager.el.querySelector(".o_global_filter_default_value");
            assert.equal(value.value, defaultValue);
            await fields.editInput(input, "New Label");
            $(actionManager.el.querySelector(".o_field_selector_value")).focusin();
            await dom.click(actionManager.el.querySelector(".o_field_selector_select_button"));
            const save = actionManager.el.querySelector(".o_spreadsheet_filter_editor_side_panel .o_global_filter_save");
            await dom.click(save);
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "New Label");
            actionManager.destroy();
        });

        QUnit.test("Default value defines value", async function (assert) {
            assert.expect(1);

            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const label = "This year";
            const defaultValue = "value";
            model.dispatch("ADD_PIVOT_FILTER", { filter: { id: "42", type: "text", label, defaultValue, fields: {}}});
            const [filter] = model.getters.getGlobalFilters();
            assert.equal(filter.value, defaultValue);
            actionManager.destroy();
        });

        QUnit.test("Default value defines value at model loading", async function (assert) {
            assert.expect(1);
            const label = "This year";
            const defaultValue = "value";
            const model = new Model({
                globalFilters: [{ type: "text", label, defaultValue, fields: {}}]
            })
            const [filter] = model.getters.getGlobalFilters();
            assert.equal(filter.value, defaultValue);
        });

        QUnit.test("Name is only fetched once", async function (assert) {
            assert.expect(7);
            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                    <pivot>
                        <field name="bar" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="product" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>
                `,
                mockRPC: function (route, args) {
                    if (args.method === "name_get" && args.model === "product") {
                        assert.step(`name_get_product_${args.args[0]}`)
                    }
                    return this._super(...arguments);
                },
            });
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "relation",
                    label: "Filter",
                    fields: {
                        1: {
                            field: "product",
                            type: "many2one",
                        }
                    },
                }
            });
            await testUtils.nextTick();
            const [sheet] = model.getters.getSheets();
            // It contains product twice
            assert.equal(sheet.cells.A4.content, `=PIVOT.HEADER("1","foo","1","product","37")`);
            assert.equal(sheet.cells.A5.content, `=PIVOT.HEADER("1","foo","1","product","41")`);
            assert.equal(sheet.cells.A7.content, `=PIVOT.HEADER("1","foo","12","product","37")`);
            assert.equal(sheet.cells.A8.content, `=PIVOT.HEADER("1","foo","12","product","41")`);
            model.dispatch("SET_PIVOT_FILTER_VALUE", {
                id: "42",
                value: [17],
            });
            await testUtils.nextTick();

            // But it only fetches names once
            assert.verifySteps([
                "name_get_product_37",
                "name_get_product_41",
            ]);
            actionManager.destroy();
        });

        QUnit.test("Name is not fetched if related record is not assigned", async function (assert) {
            assert.expect(6);
            this.data.partner.records[0].product = false
            const [ actionManager, model ] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                    <pivot>
                        <field name="bar" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="product" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>
                `,
                mockRPC: function (route, args) {
                    if (args.method === "name_get" && args.model === "product") {
                        assert.step(`name_get_product_${args.args[0]}`)
                    }
                    return this._super(...arguments);
                },
            });
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "relation",
                    label: "Filter",
                    fields: {
                        1: {
                            field: "product",
                            type: "many2one",
                        }
                    },
                }
            });
            await testUtils.nextTick();
            const [sheet] = model.getters.getSheets();
            // It contains undefined headers
            assert.equal(sheet.cells.A4.content, `=PIVOT.HEADER("1","foo","1","product","41")`);
            assert.equal(sheet.cells.A5.content, `=PIVOT.HEADER("1","foo","1","product","false")`);
            assert.equal(sheet.cells.A7.content, `=PIVOT.HEADER("1","foo","12","product","41")`);
            assert.equal(sheet.cells.A8.content, `=PIVOT.HEADER("1","foo","12","product","false")`);
            model.dispatch("SET_PIVOT_FILTER_VALUE", {
                id: "42",
                value: [17],
            });
            await testUtils.nextTick();

            // It only fetch names for defined records
            assert.verifySteps([
                "name_get_product_41",
            ]);
            actionManager.destroy();
        });

        QUnit.test("Open pivot dialog and insert a value, with UNDO/REDO", async function (assert) {
            assert.expect(4);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_pivot_table_dialog");
            await dom.click(document.body.querySelectorAll(".o_pivot_table_dialog tr th")[1]);
            assert.equal(model.getters.getCell(3, 7).content, model.getters.getCell(1, 0).content);
            model.dispatch("UNDO");
            assert.equal(model.getters.getCell(3, 7), undefined);
            model.dispatch("REDO");
            assert.equal(model.getters.getCell(3, 7).content, model.getters.getCell(1, 0).content);
            actionManager.destroy();
        });

        QUnit.test("Insert missing value modal can show only the values not used in the current sheet", async function (assert) {
            assert.expect(4);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            const missingValue = model.getters.getCell(1, 2).content;
            model.dispatch("SELECT_CELL", { col: 1, row: 2 });
            model.dispatch("DELETE_CONTENT", { sheet: model.getters.getActiveSheet(), target: model.getters.getSelectedZones() });
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            await dom.click(document.body.querySelector("input#missing_values"));
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            assert.containsN(document.body, ".o_pivot_table_dialog th", 4);
            await dom.click(document.body.querySelector(".o_missing_value"));
            assert.equal(model.getters.getCell(3, 7).content, missingValue);
            actionManager.destroy();
        });

        QUnit.test("Insert missing pivot value with two level of grouping", async function (assert) {
            assert.expect(4);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 1, row: 4 });
            model.dispatch("DELETE_CONTENT", { sheet: model.getters.getActiveSheet(), target: model.getters.getSelectedZones() });
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            await dom.click(document.body.querySelector("input#missing_values"));
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            assert.containsN(document.body, ".o_pivot_table_dialog td", 2);
            assert.containsN(document.body, ".o_pivot_table_dialog th", 5);
            actionManager.destroy();
        });

        QUnit.test("Insert missing value modal can show only the values not used in the current sheet with multiple levels", async function (assert) {
            assert.expect(4);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
        <pivot string="Partners">
            <field name="foo" type="col"/>
            <field name="product" type="col"/>
            <field name="bar" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
            });
            const missingValue = model.getters.getCell(2, 3).content;
            model.dispatch("SELECT_CELL", { col: 2, row: 3 });
            model.dispatch("DELETE_CONTENT", { sheet: model.getters.getActiveSheet(), target: model.getters.getSelectedZones() });
            model.dispatch("SELECT_CELL", { col: 9, row: 9 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            await dom.click(document.body.querySelector("input#missing_values"));
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            assert.containsN(document.body, ".o_pivot_table_dialog th", 5);
            await dom.click(document.body.querySelector(".o_missing_value"));
            assert.equal(model.getters.getCell(9, 9).content, missingValue);
            actionManager.destroy();
        });

        QUnit.test("Insert missing pivot value give the focus to the canvas when model is closed", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_pivot_table_dialog");
            await dom.click(document.body.querySelectorAll(".o_pivot_table_dialog tr th")[1]);
            assert.equal(document.activeElement.tagName, "CANVAS");
            actionManager.destroy();
        });

        QUnit.test("One col header as missing value should be displayed", async function (assert) {
            assert.expect(1);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 1, row: 0 });
            model.dispatch("DELETE_CONTENT", { sheet: model.getters.getActiveSheet(), target: model.getters.getSelectedZones() });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            await dom.click(document.body.querySelector("input#missing_values"));
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            actionManager.destroy();
        });

        QUnit.test("One row header as missing value should be displayed", async function (assert) {
            assert.expect(1);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="foo" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="product" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 0, row: 2 });
            model.dispatch("DELETE_CONTENT", { sheet: model.getters.getActiveSheet(), target: model.getters.getSelectedZones() });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            await dom.click(document.body.querySelector("input#missing_values"));
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            actionManager.destroy();
        });

        QUnit.test("A missing col in the total measures with a pivot of two GB of cols", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="bar" type="col"/>
                    <field name="product" type="col"/>
                    <field name="probability" type="measure"/>
                    <field name="foo" type="measure"/>
                </pivot>`,
            });
            await nextTick();
            await nextTick();
            model.dispatch("SELECT_CELL", { col: 5, row: 3 });
            model.dispatch("DELETE_CONTENT", { sheet: model.getters.getActiveSheet(), target: model.getters.getSelectedZones() });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
            const insertValue = cellMenuRegistry.getChildren(root, env)[0];
            await insertValue.action(env);
            await testUtils.nextTick();
            await dom.click(document.body.querySelector("input#missing_values"));
            await testUtils.nextTick();
            assert.containsOnce(document.body, ".o_missing_value");
            assert.containsN(document.body, ".o_pivot_table_dialog th", 4);
            actionManager.destroy();
        });

        QUnit.test("Grid has still the focus after a dialog", async function (assert) {
            assert.expect(1);

            const [actionManager, model] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="bar" type="col"/>
                    <field name="product" type="col"/>
                    <field name="probability" type="measure"/>
                    <field name="foo" type="measure"/>
                </pivot>`,
            });
            model.dispatch("SELECT_CELL", { col: 5, row: 3 });
            model.config.notifyUser("Notification");
            await nextTick();
            await dom.click(document.body.querySelector(".modal-footer .btn-primary"));
            await nextTick();
            assert.strictEqual(document.activeElement.tagName, "CANVAS");
            actionManager.destroy();
        });
    });
});
