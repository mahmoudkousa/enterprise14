odoo.define('voip/static/src/models/activity/activity.js', function (require) {
'use strict';

const {
    registerClassPatchModel,
    registerFieldPatchModel,
} = require('mail/static/src/model/model_core.js');
const { attr } = require('mail/static/src/model/model_field.js');

registerClassPatchModel('mail.activity', 'voip/static/src/models/activity/activity.js', {
    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * @override
     */
    convertData(data) {
        const data2 = this._super(data);
        if ('phone' in data) {
            data2.phone = data.phone;
        }
        return data2;
    },
});

registerFieldPatchModel('mail.activity', 'voip/static/src/models/activity/activity.js', {
    phone: attr(),
});

});
