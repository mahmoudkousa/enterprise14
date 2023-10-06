odoo.define("web_studio.StudioHomeMenu", function (require) {
    "use strict";

    const HomeMenu = require('web_enterprise.HomeMenu');
    const HomeMenuWrapper = require('web_enterprise.HomeMenuWrapper');
    const IconCreator = require('web_studio.IconCreator');
    const Dialog = require('web.OwlDialog');

    const NEW_APP_BUTTON = {
        isNewAppButton: true,
        label: "New App",
        webIconData: '/web_studio/static/src/img/default_icon_app.png',
    };

    /**
     * Studio home menu
     *
     * Studio version of the standard enterprise home menu. It has roughly the same
     * implementation, with the exception of the app icon edition and the app creator.
     * @extends HomeMenu
     */
    class StudioHomeMenu extends HomeMenu {
        /**
         * @param {Object} props
         * @param {Object[]} props.apps application icons
         * @param {string} props.apps[].action
         * @param {number} props.apps[].id
         * @param {string} props.apps[].label
         * @param {string} props.apps[].parents
         * @param {(boolean|string|Object)} props.apps[].webIcon either:
         *      - boolean: false (no webIcon)
         *      - string: path to Odoo icon file
         *      - Object: customized icon (background, class and color)
         * @param {string} [props.apps[].webIconData]
         * @param {string} props.apps[].xmlid
         */
        constructor() {
            super(...arguments);

            this.state.iconCreatorDialogShown = false;
            this.state.editedAppData = {};
        }

        mounted() {
            super.mounted();
            this.canEditIcons = true;
        }

        async willUpdateProps(nextProps) {
            this.availableApps = this.state.query.length ?
                this._filter(nextProps.apps) :
                nextProps.apps;
        }

        //--------------------------------------------------------------------------
        // Getters
        //--------------------------------------------------------------------------

        get displayedApps() {
            return super.displayedApps.concat([NEW_APP_BUTTON]);
        }

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * @private
         */
        _closeDialog() {
            this.state.iconCreatorDialogShown = false;
            delete this.initialAppData;
        }

        /**
         * @override
         * @private
         */
        _openMenu({ menu, isApp }) {
            if (menu.isNewAppButton) {
                this.canEditIcons = false;
                this.trigger('new-app');
            } else {
                super._openMenu(...arguments);
            }
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         */
        async _onSave() {
            const { appId, type } = this.initialAppData;
            let iconValue;
            if (this.state.editedAppData.type !== type) {
                // different type
                if (this.state.editedAppData.type === 'base64') {
                    iconValue = this.state.editedAppData.uploaded_attachment_id;
                } else {
                    const { iconClass, color, backgroundColor } = this.state.editedAppData;
                    iconValue = [iconClass, color, backgroundColor];
                }
            } else if (this.state.editedAppData.type === 'custom_icon') {
                // custom icon changed
                const { iconClass, color, backgroundColor } = this.state.editedAppData;
                if (this.initialAppData.iconClass !== iconClass ||
                    this.initialAppData.color !== color ||
                    this.initialAppData.backgroundColor !== backgroundColor) {
                    iconValue = [iconClass, color, backgroundColor];
                }
            } else if (this.state.editedAppData.uploaded_attachment_id) {
                // new attachment
                iconValue = this.state.editedAppData.uploaded_attachment_id;
            }

            if (iconValue) {
                await this.rpc({
                    route: '/web_studio/edit_menu_icon',
                    params: {
                        context: this.env.session.user_context,
                        icon: iconValue,
                        menu_id: appId,
                    },
                });
                await new Promise(resolve => {
                    this.trigger('reload_menu_data', {
                        callback: resolve,
                    });
                });
            }
            this._closeDialog();
        }

        /**
         * @private
         * @param {Object} app
         */
        _onEditIconClick(app) {
            if (!this.canEditIcons) {
                return;
            }
            if (app.webIconData) {
                this.state.editedAppData = {
                    webIconData: app.webIconData,
                    type: 'base64',
                };
            } else {
                this.state.editedAppData = {
                    backgroundColor: app.webIcon.backgroundColor,
                    color: app.webIcon.color,
                    iconClass: app.webIcon.iconClass,
                    type: 'custom_icon',
                };
            }
            this.initialAppData = Object.assign({
                appId: app.id,
            }, this.state.editedAppData);
            this.state.iconCreatorDialogShown = true;
        }

        /**
         * @private
         * @param {CustomEvent} ev
         */
        _onIconChanged(ev) {
            for (const key in this.state.editedAppData) {
                delete this.state.editedAppData[key];
            }
            for (const key in ev.detail) {
                this.state.editedAppData[key] = ev.detail[key];
            }
        }

        /**
         * @private
         */
        _onNewAppClick() {
            this.canEditIcons = false;
            this.trigger('new-app');
        }
    }

    StudioHomeMenu.components = Object.assign({},HomeMenu.components,
        { IconCreator, Dialog }
    );
    StudioHomeMenu.props = { apps: HomeMenu.props.apps };
    StudioHomeMenu.template = "web_studio.StudioHomeMenu";

    // Extends HomeMenuWrapper components
    HomeMenuWrapper.components = Object.assign({}, HomeMenuWrapper.components,
        { StudioHomeMenu }
    );

    return StudioHomeMenu;
});
