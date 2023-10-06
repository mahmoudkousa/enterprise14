odoo.define("documents_spreadsheet.DateFilterValue", function (require) {
    "use strict";

    const { getPeriodOptions } = require("web.searchUtils");

    const dateTypeOptions = {
        month: ["this_month", "last_month", "antepenultimate_month"],
        quarter: ["first_quarter", "second_quarter", "third_quarter", "fourth_quarter"],
        year: ["this_year", "last_year", "antepenultimate_year"],
    };

    /**
     * Return a list of time options to choose from according to the requested
     * type. Each option contains its (translated) description.
     * @see getPeriodOptions
     * @param {string} type "month" | "quarter" | "year"
     * @returns {Array<Object>}
     */
    function dateOptions(type) {
        return getPeriodOptions(moment()).filter(({ id }) => dateTypeOptions[type].includes(id));
    }

    class DateFilterValue extends owl.Component {
        dateOptions(type) {
            return type ? dateOptions(type) : [];
        }

        isYear() {
            return this.props.type === "year";
        }

        isSelected(periodId) {
            return [this.props.year, this.props.period].includes(periodId);
        }

        onPeriodChanged(ev) {
            const value = ev.target.value;
            this.trigger("time-range-changed", {
                year: this.props.year,
                period: value !== "empty" ? value : undefined,
            });
        }

        onYearChanged(ev) {
            const value = ev.target.value;
            this.trigger("time-range-changed", {
                year: value !== "empty" ? value : undefined,
                period: this.props.period,
            });
        }
    }
    DateFilterValue.template = "documents_spreadsheet.DateFilterValue";

    return DateFilterValue;
});
