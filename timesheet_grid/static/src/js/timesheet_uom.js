odoo.define('timesheet_grid.timesheet_uom', function (require) {
    'use strict';

    const gridComponentRegistry = require('web_grid.component_registry');
    const gridComponent = require('web_grid.components');
    const session = require('web.session');

    /**
     * Extend the float toggle widget to set default value for timesheet
     * use case. The 'range' is different from the default one of the
     * native widget, and the 'factor' is forced to be the UoM timesheet
     * conversion.
     **/
    class FloatFactorComponentTimesheet extends gridComponent.FloatFactorComponent {
        //----------------------------------------------------------------------
        // Getters
        //----------------------------------------------------------------------
        /**
         * Returns the additional options pass to the format function.
         *
         * @returns {Object}
         */
        get fieldOptions() {
            const fieldOptions = Object.assign({}, this.props.nodeOptions);
            // force factor in format and parse options
            if (this.env.session.timesheet_uom_factor) {
                fieldOptions.factor = this.env.session.timesheet_uom_factor;
            }
            return fieldOptions;
        }
    }
    class FloatToggleComponentTimesheet extends gridComponent.FloatToggleComponent {
        //----------------------------------------------------------------------
        // Getters
        //----------------------------------------------------------------------
        /**
         * Returns the additional options pass to the format function.
         *
         * @returns {Object}
         */
        get fieldOptions() {
            const fieldOptions = Object.assign({}, this.props.nodeOptions);
            // force factor in format and parse options
            if (this.env.session.timesheet_uom_factor) {
                fieldOptions.factor = this.env.session.timesheet_uom_factor;
            }
            const hasRange = Object.keys(this.props.nodeOptions || {}).includes('range');
            // the range can be customized by setting the
            // option on the field in the view arch
            if (!hasRange) {
                fieldOptions.range = [0.00, 0.50, 1.00];
            }
            return fieldOptions;
        }
    }

    /**
     * Binding depending on Company Preference
     *
     * determine which component will be the timesheet one.
     * Simply match the 'timesheet_uom' component key with the correct
     * implementation (float_time, float_toggle, ...). The default
     * value will be 'float_factor'.
     **/

    const ComponentName = 'timesheet_uom' in session ?
        session.timesheet_uom.timesheet_widget : 'float_factor';
    let FieldTimesheetUom;
    if (ComponentName === "float_toggle") {
        FieldTimesheetUom = FloatToggleComponentTimesheet;
    } else if (ComponentName === "float_factor") {
        FieldTimesheetUom = FloatFactorComponentTimesheet;
    } else {
        FieldTimesheetUom = (gridComponentRegistry.get(ComponentName) || FloatFactorComponentTimesheet);
    }
    gridComponentRegistry.add('timesheet_uom', FieldTimesheetUom);

    return FieldTimesheetUom;
});
