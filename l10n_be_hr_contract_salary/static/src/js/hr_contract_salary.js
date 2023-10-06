odoo.define('l10n_be_hr_contract_salary', function (require) {
"use strict";

const hrContractSalary = require('hr_contract_salary');

hrContractSalary.include({

    updateGrossToNetModal(data) {
        this._super(data);
        $("input[name='double_holiday_wage']").val(data['double_holiday_wage']);
    },
});

});
