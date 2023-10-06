odoo.define('project_enterprise.tests', function (require) {
    'use strict';

    const TaskGanttView = require('project_enterprise.TaskGanttView');
    const testUtils = require('web.test_utils');
    
    const { createView } = testUtils;
    
    QUnit.module('Views', {
        beforeEach: function () {
            this.data = {
                tasks: {
                    fields: {
                        id: {string: 'ID', type: 'integer'},
                        name: {string: 'Name', type: 'char'},
                        start: {string: 'Start Date', type: 'datetime'},
                        stop: {string: 'Stop Date', type: 'datetime'},
                        project_id: {string: 'Project', type: 'many2one', relation: 'projects'},
                        user_id: {string: 'Assign To', type: 'many2one', relation: 'users'},
                    },
                    records: [],
                },
            };
        },
    }, function () {
        QUnit.module('TaskGanttView');

        QUnit.test('Empty groupby "Assigned To" and "Project" can be rendered', async function (assert) {
            assert.expect(1);
            this.data["tasks"].records = [];
            var gantt = await createView({
                data: this.data,
                View: TaskGanttView,
                model: 'tasks',
                arch: '<gantt string="Tasks" date_start="start" date_stop="stop" />',
                groupBy: ['user_id', 'project_id'],
            });
            assert.containsN(gantt, ".o_gantt_row", 2);
            gantt.destroy();
        });
    });
});
