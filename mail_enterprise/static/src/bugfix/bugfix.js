/**
 * This file allows introducing new JS modules without contaminating other files.
 * This is useful when bug fixing requires adding such JS modules in stable
 * versions of Odoo. Any module that is defined in this file should be isolated
 * in its own file in master.
 */
odoo.define('mail_enterprise/static/src/bugfix/bugfix.js', function (require) {
'use strict';

const ChatterContainer = require('mail/static/src/components/chatter_container/chatter_container.js');
const { attr } = require('mail/static/src/model/model_field.js');
const { registerFieldPatchModel } = require('mail/static/src/model/model_core.js');

/**
 * This should be moved inside the mail_enterprise
 * mail_enterprise/static/src/models/chatter/chatter.js
 */
registerFieldPatchModel('mail.chatter', 'mail/static/src/models/chatter/chatter.js', {
    /**
     * The chatter is inside .form_sheet_bg class
     */
    isInFormSheetBg: attr({
        default: false,
    }),
});

/**
 * mail_enterprise/static/src/components/chatter_container/chatter_container.js
 */
Object.assign(ChatterContainer, {
    defaultProps: Object.assign(ChatterContainer.defaultProps || {}, {
        isInFormSheetBg: false,
    }),
    props: Object.assign(ChatterContainer.props, {
        isInFormSheetBg: {
            type: Boolean,
        },
    })
});

});

// Move to its own file in master.
odoo.define('mail_enterprise/static/src/components/chat_window/chat_window.js', function (require) {

const ChatWindow = require('mail/static/src/components/chat_window/chat_window.js');

const { useBackButton } = require('web_mobile.hooks');

ChatWindow.patch('mail_enterprise/static/src/components/chat_window/chat_window.js', T =>
    class extends T {

        /**
         * @override
         */
        _constructor() {
            super._constructor(...arguments);
            this._onBackButtonGlobal = this._onBackButtonGlobal.bind(this);
            useBackButton(this._onBackButtonGlobal);
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Handles the `backbutton` custom event. This event is triggered by the
         * mobile app when the back button of the device is pressed.
         *
         * @private
         * @param {CustomEvent} ev
         */
        _onBackButtonGlobal(ev) {
            if (!this.chatWindow) {
                return;
            }
            this.chatWindow.close();
        }

    }
);

});

// Move to its own file in master.
odoo.define('mail_enterprise/static/src/components/dialog/dialog.js', function (require) {

const Dialog = require('mail/static/src/components/dialog/dialog.js');
const { useBackButton } = require('web_mobile.hooks');

Dialog.patch('mail_enterprise/static/src/components/dialog/dialog.js', T =>
    class extends T {

        /**
         * @override
         */
        _constructor() {
            super._constructor(...arguments);
            this._onBackButtonGlobal = this._onBackButtonGlobal.bind(this);
            this._backButtonHandler = useBackButton(this._onBackButtonGlobal);
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Handles the `backbutton` custom event. This event is triggered by the
         * mobile app when the back button of the device is pressed.
         *
         * @private
         * @param {CustomEvent} ev
         */
        _onBackButtonGlobal(ev) {
            if (!this.dialog) {
                return;
            }
            this.dialog.delete();
        }

    }
);

});

// Move to its own file in master.
odoo.define('mail_enterprise/static/src/components/messaging_menu/messaging_menu.js', function (require) {

const MessagingMenu = require('mail/static/src/components/messaging_menu/messaging_menu.js');

const { useBackButton } = require('web_mobile.hooks');

MessagingMenu.patch('mail_enterprise/static/src/components/chat_window/chat_window.js', T =>
    class extends T {

        /**
         * @override
         */
        _constructor() {
            super._constructor(...arguments);
            this._onBackButtonGlobal = this._onBackButtonGlobal.bind(this);
            useBackButton(this._onBackButtonGlobal, () => this.messagingMenu && this.messagingMenu.isOpen);
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Handles the `backbutton` custom event. This event is triggered by the
         * mobile app when the back button of the device is pressed.
         *
         * @private
         * @param {CustomEvent} ev
         */
        _onBackButtonGlobal(ev) {
            if (!this.messagingMenu) {
                return;
            }
            this.messagingMenu.close();
        }

    }
);

});
