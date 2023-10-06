/**
 * This file allows introducing new JS modules without contaminating other files.
 * This is useful when bug fixing requires adding such JS modules in stable
 * versions of Odoo. Any module that is defined in this file should be isolated
 * in its own file in master.
 */
odoo.define('voip/static/src/bugfix/bugfix.js', function (require) {
'use strict';

const { registerInstancePatchModel } = require('mail/static/src/model/model_core.js');

registerInstancePatchModel('mail.chatter', 'voip/static/src/models/chatter/chatter.js', {

    /**
     * @override
     */
    _created() {
        const res = this._super(...arguments);
        this.env.bus.on('voip_reload_chatter', this, this._onReload);
        return res;
    },
    /**
     * @override
     */
    _willDelete() {
        this.env.bus.off('voip_reload_chatter', this, this._onReload);
        return this._super(...arguments);
    },

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    /**
     * @private
     */
    _onReload() {
        if (!this.thread) {
            return;
        }
        this.thread.refreshActivities();
        this.thread.refresh();
    },
});

});
