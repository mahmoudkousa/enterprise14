odoo.define('timesheet_grid.TimerHeaderM2O', function (require) {
"use strict";

const config = require('web.config');
const core = require('web.core');
const relational_fields = require('web.relational_fields');
const StandaloneFieldManagerMixin = require('web.StandaloneFieldManagerMixin');
const Widget = require('web.Widget');

const Many2One = relational_fields.FieldMany2One;
const _t = core._t;

const TimerHeaderM2O = Widget.extend(StandaloneFieldManagerMixin, {
    template: 'timesheet_grid.timer_project_task',
    /**
     * @constructor
     * @param {Widget} parent
     * @param {Object} params
     */
    init: function (parent, params) {
        this._super(...arguments);
        StandaloneFieldManagerMixin.init.call(this);
        this.projectId = arguments[1];
        this.taskId = arguments[2];
    },
    /**
     * @override
     */
    willStart: async function () {
        await this._super(...arguments);

        const project_domain = await this._rpc({
            model: 'account.analytic.line',
            method: 'get_m2o_timer_project_domain',
            args: [],
        })
        this.project = await this.model.makeRecord('account.analytic.line', [{
            name: 'project_id',
            relation: 'project.project',
            type: 'many2one',
            value: this.projectId,
            domain: project_domain,
        }]);

        this.task = await this.model.makeRecord('account.analytic.line', [{
            name: 'task_id',
            relation: 'project.task',
            type: 'many2one',
            value: this.taskId,
            domain: [['project_id', '=', this.projectId]]
        }]);
    },
    /**
     * @override
     */
    start: async function () {
        const _super = this._super.bind(this);
        let placeholderTask, placeholderProject;
        if (config.device.isMobile) {
            placeholderTask = _t('Task');
            placeholderProject = _t('Project');
        } else {
            placeholderTask = _t('Select a Task');
            placeholderProject = _t('Select a Project');
        }
        const projectRecord = this.model.get(this.project);
        const projectMany2one = new Many2One(this, 'project_id', projectRecord, {
            attrs: {
                string: _t('Project'),
                placeholder: placeholderProject,
            },
            noOpen: true,
            noCreate: true,
            mode: 'edit',
            required: true,
        });
        projectMany2one.field['required'] = true;
        this._registerWidget(this.project, 'project_id', projectMany2one);
        await projectMany2one.appendTo(this.$('.timer_project_id'));
        this.projectMany2one = projectMany2one;

        const taskRecord = this.model.get(this.task);
        const taskMany2one = new Many2One(this, 'task_id', taskRecord, {
            attrs: {
                string: _t('Task'),
                placeholder: placeholderTask,
            },
            noOpen: true,
            noCreate: true,
            mode: 'edit',
        });
        this._registerWidget(this.task, 'task_id', taskMany2one);
        await taskMany2one.appendTo(this.$('.timer_task_id'));
        this.taskMany2one = taskMany2one;
        this.$('.timer_project_id').addClass('o_required_modifier');

        _super.apply(...arguments);
    },
    /**
     * @private
     */
    _updateRequiredField: function () {
        if (this.projectId === undefined) {
            this.$('.timer_label_project').addClass('o_field_invalid');
            this.$('.timer_project_id').addClass('o_field_invalid');
        } else {
            this.$('.timer_label_project').removeClass('o_field_invalid');
            this.$('.timer_project_id').removeClass('o_field_invalid');
        }
    },

    /**
     * @private
     * @override
     * @param {OdooEvent} ev
     */
    _onFieldChanged: async function (ev) {
        const project = this.projectId;
        const task = (this.taskId) ? this.taskId : false;
        await StandaloneFieldManagerMixin._onFieldChanged.apply(this, arguments);
        const fieldName = ev.target.name;
        let record;
        if (fieldName === 'project_id') {
            record = this.model.get(this.project);
            var newId = record.data.project_id.res_id;
            if (project !== newId) {
                this.projectId = newId;
                this.taskId = false;

                this.taskMany2one.value = [];
                this.taskMany2one.m2o_value = this.taskMany2one._formatValue([]);
                this.taskMany2one._render();
                this.taskMany2one.field.domain = [['project_id', '=', newId]];
                this.trigger_up('timer-edit-project', {'projectId': newId});
                this._updateRequiredField();
            }
        } else if (fieldName === 'task_id') {
            record = this.model.get(this.task);
            const newId = record.data.task_id && record.data.task_id.res_id;
            if (task !== newId) {
                this.taskId = false;
                this.trigger_up('timer-edit-task', {'taskId': newId});
            }
        }
    },
});

return TimerHeaderM2O;

});
