odoo.define('timesheet_grid.GridModel', function (require) {
    "use strict";

    const { _t } = require('web.core');
    const GridModel = require('web_grid.GridModel');

    const TimesheetGridModel = GridModel.extend({

        // -------------------------------------------------------------------------
        // Private
        // -------------------------------------------------------------------------

        /**
         * Ensures that no date field is present in the group_by of the view and returns the
         * sanitized group_by.
         * @param {Object} params The params passed to the caller function.
         * @param {string} groupByPropName The name of the property name in params which provides the
         *                         group_by applied in the view.
         * @returns {Object} The sanitized params.
         * @private
         */
        _manageGroupBy(params, groupByPropName) {
            if (params && groupByPropName in params) {
                const groupBy = params[groupByPropName]
                const filteredGroupBy = groupBy.filter(filter => {
                    return filter.split(':').length === 1;
                });
                if (filteredGroupBy.length !== groupBy.length) {
                    this.do_warn(false, _t('Grouping by date is not supported'));
                }
                params[groupByPropName] = filteredGroupBy;
            }
            return params;
        },
        /**
         * @override
         */
        async __load(params) {
            params = this._manageGroupBy(params, 'groupedBy');
            await this._super(params);
        },
        /**
         * @override
         */
        async __reload(handle, params) {
            params = this._manageGroupBy(params, 'groupBy');
            await this._super(handle, params);
        },
    });

    return TimesheetGridModel;
});
