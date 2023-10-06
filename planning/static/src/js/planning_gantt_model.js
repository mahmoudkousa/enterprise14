odoo.define('planning.PlanningGanttModel', function (require) {
    "use strict";

    var GanttModel = require('web_gantt.GanttModel');
    var _t = require('web.core')._t;

    var PlanningGanttModel = GanttModel.extend({
        /**
         * @override
         */
        __reload: function (handle, params) {
            if ('context' in params && params.context.planning_groupby_role && !params.groupBy.length) {
                params.groupBy.unshift('employee_id');
                params.groupBy.unshift('role_id');
            }

            return this._super(handle, params);
        },
        /**
         * @private
         * @override
         * @returns {Object[]}
         */
        _generateRows: function (params) {
            var rows = this._super(params);
            // always move an empty row to the head
            if (params.groupedBy && params.groupedBy.length && rows.length > 1 && rows[0].resId) {
                this._reorderEmptyRow(rows)
            }
            this._renameOpenShifts(rows);
            // always prepend an empty row if employee_id is in the group_by
            if (!this.context.hide_open_shift && !params.parentPath && params.groupedBy && params.groupedBy.includes('employee_id')) {
                this._prependEmptyRow(rows, params.groupedBy);
            }
            // generate empty rows for selected associations of group by
            if (!this.context.hide_open_shift && !params.parentPath && params.groupedBy && this._allowedEmptyGroups(params.groupedBy)) {
                this._startGenerateEmptyRows(rows, params.groupedBy);
            }
            return rows;
        },
        /**
         * Recursive function that will generate the empty row for the last group in the groupedBy array.
         * An empty row is a row that has the value of the model (resId) linked to it equal to false.
         *
         * @private
         * @param {Object} row
         * @param {string[]} groupedBy
         * @param {integer} level
         * @param {Object} parentValues
         * @param {boolean} prependUndefined
         */
        _generateEmptyRows: function (row, groupedBy, level = 0, parentValues = {}, prependUndefined = false) {
            var levelMax = groupedBy.length - 1;
            var emptyRowId = row.id + '-empty';
            var emptyGroupId = row.id + '-empty';
            var undefinedGroupBy = groupedBy[level + 1];
            parentValues[row.groupedByField] = row.resId ? [row.resId, row.name] : false;

            if (prependUndefined) {
                if (!row.rows || !row.rows.length || row.rows[0].resId) {
                    row.rows.unshift(this._createEmptyRow(emptyRowId, emptyGroupId, groupedBy.slice(level + 1), row.path, level < levelMax - 1));
                    row.childrenRowIds.unshift(emptyRowId);

                    if (level === levelMax - 1) {
                        this._addGanttEmptyGroup(emptyGroupId, parentValues, undefinedGroupBy);
                    }
                }
                if (level < levelMax - 1) {
                    this._generateEmptyRows(row.rows[0], groupedBy, level + 1, parentValues, prependUndefined);
                }
            } else if (level < levelMax - 1 && row.rows && row.rows.length) {
                row.rows.forEach((childRow) => this._generateEmptyRows(childRow, groupedBy, level + 1, parentValues));
            // create empty row for the last group in the groupedBy array
            // the empty row has to be added to the children list of his parent, so the action takes place in the parent of the last group
            // the empty row must be the first child, so if the first child has a value, it means there is no empty row yet
            } else if (level === levelMax - 1 && row.rows && row.rows.length && row.rows[0].resId) {
                row.rows.unshift(this._createEmptyRow(emptyRowId, emptyGroupId, groupedBy.slice(level + 1), row.path));
                row.childrenRowIds.unshift(emptyRowId);
                this._addGanttEmptyGroup(emptyGroupId, parentValues, undefinedGroupBy);
            }
            if (row.rows) {
                for (const subRow of row.rows) {
                    row.childrenRowIds = row.childrenRowIds.concat(subRow.childrenRowIds || []);
                }
                row.childrenRowIds = [...new Set(row.childrenRowIds)];
            }
        },
        /**
         * Create and return an empty row.
         *
         * @private
         * @param {string} rowId
         * @param {string} groupId
         * @param {string} groupBy
         * @param {string|null} parentPath
         * @param {boolean} isGroup
         * @returns {Object}
         */
        _createEmptyRow: function (rowId, groupId, groupedBy, parentPath = null, isGroup = false) {
            const groupedByField = groupedBy[0];
            const row = {
                name: ['employee_id', 'department_id'].includes(groupedByField) ? _t('Open Shifts') : this._getFieldFormattedValue(false, this.ganttData.fields[groupedByField]),
                groupId: groupId,
                groupedBy,
                groupedByField,
                id: rowId,
                resId: false,
                isGroup: isGroup,
                isOpen: true,
                path: parentPath ? parentPath + '/false' : 'false',
                records: [],
                unavailabilities: [],
                rows: isGroup ? [] : null,
                childrenRowIds: isGroup ? [] : null
            };
            this.allRows[rowId] = row;
            return row;
        },
        /**
         * Create a Gantt group and add it to the Gantt data.
         *
         * @private
         * @param {string} groupId
         * @param {Object} parentValues
         * @param {string} emptyKey
         */
        _addGanttEmptyGroup: function (groupId, parentValues, emptyKey) {
            var group = {id: groupId};
            Object.keys(parentValues).forEach((key) => group[key] = parentValues[key]);
            group[emptyKey] = false;
            this.ganttData.groups.push(group);
        },
        /**
         * Rename 'Undefined Employee' and 'Undefined Department' to 'Open Shifts'.
         *
         * @private
         * @param {Object[]} rows
         */
        _renameOpenShifts: function (rows) {
            rows.filter(row => ['employee_id', 'department_id'].includes(row.groupedByField) && !row.resId)
                .forEach(row => row.name = _t('Open Shifts'));
        },
        /**
         * Find an empty row and move it at the head of the array.
         *
         * @private
         * @param {Object[]} rows
         */
        _reorderEmptyRow: function (rows) {
            let emptyIndex = null;
            for (let i = 0; i < rows.length; ++i) {
                if (!rows[i].resId) {
                    emptyIndex = i;
                    break;
                }
            }
            if (emptyIndex) {
                const emptyRow = rows.splice(emptyIndex, 1)[0];
                rows.unshift(emptyRow);
            }
        },
        /**
         * Prepend an empty row if the first one is not an empty one.
         * Replace the default row by an empty one when there is no data.
         *
         * @private
         * @param {Object[]} rows
         * @param {string[]} groupedBy
         */
        _prependEmptyRow: function (rows, groupedBy) {
            const prependEmptyRow = (rows.length === 1 && !rows[0].id) || rows[0].resId;
            if (prependEmptyRow) {
                // remove the default empty row
                if (!rows[0].id) {
                    rows.splice(0, 1);
                }
                rows.unshift(this._createEmptyRow('empty', 'empty', groupedBy, null, groupedBy.length > 1));
                if (groupedBy.length === 1) {
                    this._addGanttEmptyGroup('empty', {[groupedBy[0]]: false}, groupedBy[0]);
                }
            }
            if (groupedBy.length > 1) {
                this._generateEmptyRows(rows[0], groupedBy, 0, {}, true);
            }
        },
        /**
         * Start the generation of the empty rows for the last group in groupedBy.
         *
         * @private
         * @param {Object[]} rows
         * @param {string[]} groupedBy
         */
        _startGenerateEmptyRows: function (rows, groupedBy) {
            // for one-level group by, directly create the empty row
            if (groupedBy.length === 1 && rows.length > 0 && rows[0].resId) {
                rows.unshift(this._createEmptyRow('empty', 'empty', groupedBy));
                this._addGanttEmptyGroup('empty', {}, groupedBy[0]);
            } else if (groupedBy.length > 1) {
                rows.forEach((row) => this._generateEmptyRows(row, groupedBy));
            }
        },
        /**
         * Check if the given groupBy is in the list that has to generate undefined lines.
         *
         * @private
         * @param {string[]} groupedBy
         * @returns {boolean}
         */
        _allowedEmptyGroups: function (groupedBy) {
            return -1 < this._getEmptyGroupsToDisplay().indexOf(groupedBy.join(','));
        },
        /**
         * Return the list of groupBy for which undefined line has to be displayed.
         * An array of strings is used to ease the comparison.
         *
         * @private
         * @returns {string[]}
         */
        _getEmptyGroupsToDisplay: function () {
            return [
                'role_id',
                'role_id,employee_id',
                'role_id,department_id',
                'department_id',
                'department_id,role_id',
                'project_id',
                'project_id,department_id',
                'project_id,employee_id',
                'project_id,role_id',
                'project_id,task_id,employee_id',
                'project_id,task_id,role_id',
                'task_id',
                'task_id,department_id',
                'task_id,employee_id',
                'task_id,role_id',
            ];
        },
    });

    return PlanningGanttModel;
});
