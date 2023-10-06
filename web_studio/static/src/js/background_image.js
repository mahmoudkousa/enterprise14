odoo.define('web_studio.BackgroundImage', function (require) {
    "use strict";

    const session = require('web.session');
    const WebClient = require('web.WebClient');

    // Most of the studio assets are only loaded when opening studio first time but
    // we need to manage the background image even if studio has not been opened yet.
    WebClient.include({

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        /**
         * @override
         */
        async load_menus() {
            const menuData = await this._super(...arguments);
            if (menuData.background_image) {
                const company_id = session.user_context.allowed_company_ids[0];
                const url = session.url('/web/image', {
                    id: company_id,
                    model: 'res.company',
                    field: 'background_image',
                });
                this.homeMenuStyle = `background-image: url(${url})`;
            }
            return menuData;
        },

        /**
         * @override
         */
        async toggleHomeMenu(display) {
            // Adds a class on the webclient on top of the o_home_menu_background
            // class to inform that the home menu is customized.
            this.el.classList.toggle('o_home_menu_background_custom', Boolean(display && this.homeMenuStyle));
            return this._super(...arguments);
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * @override
         * @private
         */
        _instanciateHomeMenuWrapper() {
            const homeMenuManager = this._super(...arguments);
            if (this.homeMenuStyle) {
                homeMenuManager.state.style = this.homeMenuStyle;
            }
            return homeMenuManager;
        },
    });
});
