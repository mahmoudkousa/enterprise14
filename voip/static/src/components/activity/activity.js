odoo.define('voip/static/src/components/activity/activity.js', function (require) {
'use strict';

const components = {
    Activity: require('mail/static/src/components/activity/activity.js'),
};

const { patch } = require('web.utils');

patch(components.Activity, 'voip/static/src/components/activity/activity.js', {
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickVoipCall(ev) {
        ev.preventDefault();
        this.trigger('voip_activity_call', {
            activityId: this.activity.id,
            number: this.activity.phone,
        });
    },
});

});
