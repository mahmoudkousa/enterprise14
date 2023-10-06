odoo.define('web_studio.WebClient', function (require) {
"use strict";

const ajax = require('web.ajax');
const { bus, _t } = require('web.core');
const session = require('web.session');
const WebClient = require('web.WebClient');

const studioBus = require('web_studio.bus');
const SystrayItem = require('web_studio.SystrayItem');

WebClient.include({
    events: _.extend({}, WebClient.prototype.events, {
        'new-app': 'openAppCreator',
        'reload_menu_data': '_onReloadMenuData',
    }),
    custom_events: _.extend({}, WebClient.prototype.custom_events, {
        'new_app_created': '_onNewAppCreated',
        'reload_menu_data': '_onReloadMenuData',
        'studio_history_back': '_onStudioHistoryBack',
        'studio_icon_clicked': '_onStudioIconClicked',
        'switch_studio_view': '_onSwitchStudioView',
    }),

    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);

        // can either be 'app_creator' or 'main' while in Studio, and false otherwise
        this.studioMode = false;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    current_action_updated: function (action) {
        this._super.apply(this, arguments);

        // in Studio, the systray item is replaced by a "Close" button so no
        // need to update it
        if (!this.studioMode) {
            this._updateStudioSystray(this._isStudioEditable(action));
        }
    },
    /**
     * Considers the Studio menu when instatiating the menu.
     *
     * @override
     */
    _instanciateMenu: async function () {
        const menu = await this._super.apply(this, arguments);
        if (this.studioMode === 'main') {
            const action = this.action_manager.getCurrentStudioAction();
            if (action) {
                await menu.renderStudioMenu(action);
            }
        }
        return menu;
    },
    /**
     * @override
     */
    do_action: function (action, options) {
        if (this.studioMode === 'main' && action.target === 'new') {
            // Wizards in the app creator can be opened (ex: Import wizard)
            // TODO: what if we modify target = 'curent' to modify it?
            this.do_warn(false, _t("Wizards are not editable with Studio"));
            return Promise.reject();
        }

        var blockPushState = this.studioMode && !action.studioNavigation;
        if (blockPushState) {
            // we are doing action inside Studio but as the currently edited
            // action in Studio does not change, the state cannot change
            options = options || {};
            options.pushState = false;
        }
        var prom =  this._super(action, options);
        prom.then(function (action) {
            if (blockPushState) {
                // pushState is reset to true in action_manager (see @doAction)
                // but we never want the state to be updated in Studio
                action.pushState = false;
            }
        });
        return prom;
    },
    /**
     * @override
     */
    on_app_clicked: async function () {
        if (this.studioMode) {
            // used to avoid a flickering issue (see @toggleHomeMenu)
            this.openingMenu = true;
        }
        await this._super(...arguments);
        // this is normally done by _on_app_clicked_done but should also be
        // done if the promise is rejected
        this.openingMenu = false;
    },
    /**
     * Opens the App Creator action.
     *
     * @returns {Promise}
     */
    openAppCreator: async function () {
        await this.do_action('action_web_studio_app_creator');
        this.menu.toggle_mode(true, false);  // hide the back button
    },
    /**
     * @override
     */
    show_application: async function () {
        const _super = this._super.bind(this);
        const qs = $.deparam.querystring();
        this.studioMode = ['main', 'app_creator'].includes(qs.studio) && qs.studio;
        if (this.studioMode) {
            await ajax.loadLibs({ assetLibs: this._studioAssets });
        }
        await _super(...arguments);
        if (this.studioMode) {
            this._updateContext();
            return this._openStudio();
        }
    },
    /**
     * @override
     */
    toggleHomeMenu: function (display) {
        if (this.studioMode) {
            if (display) {
                // use case: we are in Studio main and we toggle the home menu
                // --> will open the app_creator
                this.studioMode = 'app_creator';
            } else {
                var action = this.action_manager.getCurrentAction();
                if (action && action.tag === 'action_web_studio_app_creator') {
                    // use case: Studio has been toggled and the app creator is
                    // opened by clicking on the "New App" icon
                    this.studioMode = 'app_creator';
                } else {
                    // use case: being on the HomeMenu in Studio mode and then
                    // toggling the HomeMenu
                    this.studioMode = 'main';
                }
                if (this.openingMenu) {
                    // use case: navigating in an app from the app switcher
                    // the first toggleHomeMenu will be triggered when opening
                    // a menu ; it must be prevented to avoid flickering
                    return;
                }
            }
            this._toggleStudioMode();
        } else {
            if (display) {
                // Studio icon is enabled in the home menu (to be able to always
                // open the AppCreator)
                this._updateStudioSystray(true);
            }
        }
        this.homeMenuManager.state.studioMode = this.studioMode;
        return this._super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    _instanciateHomeMenuWrapper: function () {
        const homeMenuManager = this._super(...arguments);
        homeMenuManager.state.studioMode = this.studioMode;
        return homeMenuManager;
    },
    /**
     * Closes Studio.
     *
     * @private
     * @returns {Promise}
     */
    _closeStudio: async function () {
        const action = this.action_manager.getCurrentAction();

        if (this.homeMenuManagerDisplayed) {
            this.menu.toggle_mode(true, false);  // hide the back button
            await this._updateStudioSystray(true);
        } else if (action.tag === 'action_web_studio_app_creator') {
            this.menu.toggle_mode(true, false);
            await this.toggleHomeMenu(true);
        } else {
            await this.action_manager.restoreStudioAction();
        }

        this._toggleStudioMode();
        this.el.classList.toggle('o_in_studio', Boolean(this.studioMode));
    },
    /**
     * Studio is disabled by default in systray.
     * Add conditions here to enable it.
     *
     * @private
     * @returns {Boolean} the 'Studio editable' property of an action
     */
    _isStudioEditable: function (action) {
        return Boolean(action &&
               action.xml_id &&
               action.type === 'ir.actions.act_window' &&
               action.res_model &&
               // we don't want to edit Settings as it is a special case of form view
               // this is a heuristic to determine if the action is Settings
               (action.res_model.indexOf('settings') === -1 || action.res_model.indexOf('x_') === 0) &&
               // we don't want to edit Dashboard views
               action.res_model !== 'board.board');
    },
    /**
     * Opens the Studio main action with the AM current action.
     *
     * @private
     * @param {string} [viewType]
     * @returns {Promise}
     */
    _navigateInStudio: function (viewType) {
        var self = this;
        // the action has been processed by the AM
        var action = this.action_manager.getLastAction();
        var options = {
            action: action,
            viewType: viewType,
        };
        return this._openStudioMain(options).then(function () {
            self.openingMenu = false;  // see @toggleHomeMenu
        });
    },
    /**
     * @override
     */
    _openMenu: function (action, options) {
        var self = this;
        if (this.studioMode) {
            if (!this._isStudioEditable(action)) {
                this.do_warn(false, _t("This action is not editable by Studio"));
                return Promise.reject();
            }
            // tag the action for the actionManager
            action.studioNavigation = true;
        }
        return this._super.apply(this, arguments).then(function () {
            if (self.studioMode) {
                return self._navigateInStudio(options.viewType);
            }
        });
    },
    /**
     * @private
     * @returns {Promise}
     */
    _studioAssets: ['web_editor.compiled_assets_wysiwyg', 'web_studio.compiled_assets_studio'],
    _openStudio: async function () {
        await ajax.loadLibs({ assetLibs: this._studioAssets });

        if (this.studioMode === 'main') {
            var action = this.action_manager.getCurrentAction();
            var controller = this.action_manager.getCurrentController();
            await this._openStudioMain({
                action: action,
                controllerState: controller.widget.exportState(),
                viewType: controller.viewType,
            });
        } else {
            // the app creator is not opened here, it's opened by clicking on
            // the "New App" icon, when the HomeMenu is in `studio` mode.
            // TODO: check if await is necessary here
            this.menu.toggle_mode(true, false);  // hide the back button

        }
        this.el.classList.toggle('o_in_studio', !!this.studioMode);
        this._toggleStudioMode();
    },
    /**
     * Opens the Studio main action with a specific action.
     *
     * @private
     * @param {Object} options
     * @param {Object} options.action
     * @param {string} options.action.res_model
     * @returns {Promise}
     */
    _openStudioMain: function (options) {
        return this.do_action('action_web_studio_action_editor', options);
    },
    /**
     * @private
     * @returns {Promise}
     */
    _reinstanciateMenu: async function (newMenuData) {
        const oldMenu = this.menu;
        this.menu = await this._instanciateMenu(newMenuData);

        if (oldMenu) {
            oldMenu.destroy();
        }

        this.el.prepend(this.menu.el);
    },
    /**
     * @private
     */
    _toggleStudioMode: function () {
        studioBus.trigger('studio_toggled', this.studioMode);

        // update the URL query string with Studio
        const qs = $.deparam.querystring();
        if (this.studioMode) {
            qs.studio = this.studioMode;
        } else {
            delete qs.studio;
        }
        const { protocol, host, pathname, hash } = window.location;
        const url = `${protocol}//${host}${pathname}?${$.param(qs)}${hash}`;
        window.history.pushState({ path: url }, '', url);

        this.homeMenuManager.state.studioMode = this.studioMode;
    },
    /**
     * Writes in user_context that we are in Studio.
     * This is used server-side to flag with Studio the ir.model.data of
     * customizations.
     *
     * @private
     */
    _updateContext: function () {
        if (this.studioMode) {
            session.user_context.studio = 1;
        } else {
            delete session.user_context.studio;
        }
    },
    /**
     * Enables or disables the Studio systray icon.
     *
     * @private
     * @param {Boolean} show
     * @returns {Promise}
     */
    _updateStudioSystray: async function (show) {
        const studioSystrayItem = this.menu.systray_menu.widgets.find(widget =>
            widget instanceof SystrayItem);
        if (show) {
            await studioSystrayItem.enable();
        } else {
            await studioSystrayItem.disable();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onStudioHistoryBack: function () {
        this.action_manager.studioHistoryBack();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onNewAppCreated: async function (ev) {
        bus.trigger('clear_cache');

        // Load menu data, create a new menu and remove the home menu/studio home menu
        const menuData = await this.load_menus();
        await this._reinstanciateMenu(menuData);
        this.homeMenuManager.updateMenuData(menuData);

        const detail = Object.assign({
            menu_id: null,
            action_id: null,
            options: { viewType: 'form' },
        }, ev.data);
        await this.on_app_clicked({ detail });
        this.menu.toggle_mode(false);  // display home menu button
    },
    /**
     * @private
     * @param {OdooEvent} [ev={}]
     */
    _onReloadMenuData: async function (ev={}) {
        const current_primary_menu = this.menu.current_primary_menu;
        bus.trigger('clear_cache');

        // Load menu data, create a new menu and remove the home menu/studio home menu
        const menuData = await this.load_menus();
        await this._reinstanciateMenu(menuData);
        this.homeMenuManager.updateMenuData(menuData);

        this.menu.toggle_mode(this.homeMenuManagerDisplayed);
        this.menu.change_menu_section(current_primary_menu); // entering the current menu
        this.menu.switchMode(this.studioMode);
        this._updateStudioSystray(this.studioMode);

        const detail = ev.data || ev.detail || {};
        if (detail.keep_open && this.menu.edit_menu) {
            this.menu.edit_menu.editMenu(detail.scroll_to_bottom);
        }

        if (detail.def) {
            detail.def.resolve();
        }

        if (detail.callback) {
            detail.callback();
        }
    },
    /**
     * @private
     */
    _onStudioIconClicked: async function () {
        // the app creator will be opened if the home menu is displayed
        const newMode = this.homeMenuManagerDisplayed ? 'app_creator': 'main';
        this.studioMode = this.studioMode ? false : newMode;

        this._updateContext();
        if (this.studioMode) {
            await this._openStudio();
        } else {
            await this._closeStudio();
        }
        this.homeMenuManager.state.studioMode = this.studioMode;
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSwitchStudioView: function (ev) {
        var action = this.action_manager.getCurrentStudioAction();
        var controller = this.action_manager.getCurrentStudioController();
        var params = _.extend({}, ev.data, {
            action: action,
        });
        if (controller.widget) {
            // not always the case in case of navigation
            params.controllerState = controller.widget.exportState();
        }
        this._openStudioMain(params);
    },
});

});
