odoo.define("planning.planning_gantt_tests.js", function (require) {
    "use strict";

    const Domain = require("web.Domain");
    const PlanningGanttView = require("planning.PlanningGanttView");
    const testUtils = require("web.test_utils");

    const actualDate = new Date(2018, 11, 20, 8, 0, 0);
    const initialDate = new Date(
        actualDate.getTime() - actualDate.getTimezoneOffset() * 60 * 1000
    );
    const { createView } = testUtils;

    QUnit.module("Planning", {
        beforeEach() {
            this.data = {
                task: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        start: { string: "Start Date", type: "datetime" },
                        stop: { string: "Stop Date", type: "datetime" },
                        time: { string: "Time", type: "float" },
                        employee_id: {
                            string: "Assigned to",
                            type: "many2one",
                            relation: "hr.employee",
                        },
                        department_id: {
                            string: "Department",
                            type: "many2one",
                            relation: "department",
                        },
                        role_id: {
                            string: "Role",
                            type: "many2one",
                            relation: "role",
                        },
                        active: { string: "active", type: "boolean", default: true },
                    },
                    records: [],
                },
                'hr.employee': {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
                department: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
                role: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [],
                },
            };
        },
    }, function () {

        QUnit.module("Gantt");

        QUnit.test("empty gantt view with sample data: send schedule", async function (assert) {
            assert.expect(4);

            this.data.task.records = [];

            const gantt = await createView({
                arch: `
                    <gantt date_start="start" date_stop="stop" sample="1"/>`,
                data: this.data,
                domain: Domain.FALSE_DOMAIN,
                groupBy: ["employee_id"],
                model: "task",
                View: PlanningGanttView,
                viewOptions: { initialDate },
            });

            testUtils.mock.intercept(gantt, "do_action", function ({ data }) {
                assert.strictEqual(data.action, "planning.planning_send_action");
                assert.deepEqual(data.options.additional_context, {
                    active_domain: Domain.FALSE_DOMAIN,
                    active_ids: [],
                    default_employee_ids: [],
                    default_slot_ids: [],
                    default_end_datetime: "2018-12-31 23:59:59",
                    default_start_datetime: "2018-12-01 00:00:00",
                    scale: "month",
                }, "sample data should not be sent to the server");
            });

            assert.hasClass(gantt, "o_view_sample_data");
            assert.ok(gantt.$(".o_gantt_row").length > 2,
                'should contain at least two rows (the generic one, and at least one for sample data)');

            await testUtils.dom.click(gantt.el.querySelector(".btn.o_gantt_button_send_all"));

            gantt.destroy();
        });

        QUnit.test('add record in empty gantt with sample="1"', async function (assert) {
            assert.expect(5);

            this.data.task.records = [];

            const gantt = await createView({
                View: PlanningGanttView,
                model: 'task',
                data: this.data,
                arch: '<gantt date_start="start" date_stop="stop" sample="1"/>',
                archs: {
                    'task,false,form': `
                        <form>
                            <field name="name"/>
                            <field name="start"/>
                            <field name="stop"/>
                            <field name="employee_id"/>
                        </form>`,
                },
                viewOptions: {
                    initialDate: new Date(),
                },
                groupBy: ['employee_id'],
            });

            assert.hasClass(gantt, 'o_view_sample_data');
            assert.ok(gantt.$('.o_gantt_pill_wrapper').length > 0, "sample records should be displayed");

            await testUtils.dom.triggerMouseEvent(gantt.$(`.o_gantt_row:first .o_gantt_cell:first .o_gantt_cell_add`), "click");
            await testUtils.fields.editInput($('.modal .modal-body input[name=name]'), 'new task');
            await testUtils.modal.clickButton('Save & Close');

            assert.doesNotHaveClass(gantt, 'o_view_sample_data');
            assert.containsOnce(gantt, '.o_gantt_row');
            assert.containsOnce(gantt, '.o_gantt_pill_wrapper');

            gantt.destroy();
        });

        QUnit.test("gantt view collapse and expand empty rows in multi groupby", async function (assert) {
            assert.expect(9);

            const gantt = await createView({
                View: PlanningGanttView,
                model: 'task',
                data: this.data,
                arch: '<gantt date_start="start" date_stop="stop"/>',
                archs: {
                    'task,false,form': `
                        <form>
                            <field name="name"/>
                            <field name="start"/>
                            <field name="stop"/>
                            <field name="employee_id"/>
                            <field name="role_id"/>
                            <field name="department_id"/>
                        </form>`,
                },
                viewOptions: {
                    initialDate: new Date(),
                },
                groupBy: ['department_id', 'role_id', 'employee_id'],
            });

            function getRow(index) {
                return gantt.el.querySelectorAll('.o_gantt_row_container > .row')[index];
            }
            assert.strictEqual(getRow(0).innerText.replace(/\s/, ''), 'Open Shifts',
                'should contain "Open Shifts" as a first group header for grouped by "Department"');
            assert.strictEqual(getRow(1).innerText.replace(/\s/, ''), 'Undefined Role',
                'should contain "Undefined Role" as a first group header for grouped by "Role"');
            assert.strictEqual(getRow(2).innerText, 'Open Shifts',
                'should contain "Open Shifts" as a first group header for grouped by "Employee"');

            await testUtils.dom.click(getRow(0));
            assert.doesNotHaveClass(getRow(0), 'open',
                "'Open Shift' Group Collapsed");
            await testUtils.dom.click(getRow(0));
            assert.hasClass(getRow(0), 'open',
                "'Open Shift' Group Expanded");
            assert.strictEqual(getRow(2).innerText, 'Open Shifts',
                'should contain "Open Shifts" as a first group header for grouped by "Employee"');
            await testUtils.dom.click(getRow(1));
            assert.doesNotHaveClass(getRow(1), 'open',
                "'Undefined Role' Sub Group Collapsed");
            await testUtils.dom.click(getRow(1));
            assert.hasClass(getRow(1), 'open',
                "'Undefined Role' Sub Group Expanded");
            assert.strictEqual(getRow(2).innerText, 'Open Shifts',
                'should contain "Open Shifts" as a first group header for grouped by "Employee"');

            gantt.destroy();
        });

    });
});
