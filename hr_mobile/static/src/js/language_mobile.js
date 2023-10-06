odoo.define('web_mobile.employee_language', function (require) {
    'use strict';

    const EmployeeProfileFormView = require('hr.employee_language');
    const { UpdateDeviceAccountControllerMixin } = require('web_mobile.mixins');

    EmployeeProfileFormView.prototype.config.Controller.include(UpdateDeviceAccountControllerMixin);
});
