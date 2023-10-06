odoo.define('account_online_synchronization.odoo_fin_connector', function(require) {
"use strict";

    var core = require('web.core');
    var ajax = require('web.ajax');

    function OdooFinConnector (parent, action) {
        const id = action.id;
        let mode = action.params.mode || 'link';
        // Ensure that the proxyMode is valid
        const modeRegexp = /^[a-z0-9-_]+$/i;
        const runbotRegexp = /^https:\/\/[a-z0-9-_]+\.[a-z0-9-_]+\.odoo\.com$/i;
        if (!modeRegexp.test(action.params.proxyMode) && !runbotRegexp.test(action.params.proxyMode)) {
            return
        }
        let url = 'https://' + action.params.proxyMode + '.odoofin.com/proxy/v1/odoofin_link';
        if (runbotRegexp.test(action.params.proxyMode)) {
            url = action.params.proxyMode + '/proxy/v1/odoofin_link';
        }
        ajax.loadJS(url)
        .then(function () {
            // Create and open the iframe
            let params = {
                data: action.params,
                proxyMode: action.params.proxyMode,
                onEvent: function(event, data){
                    switch(event) {
                        case 'close':
                            return;
                        case 'reload':
                            return parent.do_action({type: 'ir.actions.client', tag: 'reload'});
                        case 'notification':
                            parent.displayNotification(data);
                            break;
                        case 'exchange_token':
                            parent._rpc({
                                model: 'account.online.link',
                                method: 'exchange_token',
                                args: [[id], data]
                            })
                            break;
                        case 'success':
                            mode = data.mode || mode;
                            return parent._rpc({
                                model: 'account.online.link',
                                method: 'success',
                                args: [[id], mode, data]
                            })
                            .then(action => parent.do_action(action));
                        default:
                            return;
                    }
                },
                onAddBank: function() {
                    // If the user doesn't find his bank.
                    return parent._rpc({
                        model: 'account.online.link',
                        method: 'create_new_bank_account_action',
                    })
                    .then(function(action) {
                        return parent.do_action(action, {replace_last_action: true});
                    });
                }
            }
            // propagate parent debug mode to iframe
            if (typeof debugMode !== 'undefined' && debugMode)
                params.data['debug'] = debugMode;
            OdooFin.create(params);
            OdooFin.open();
            // This is needed in case iframe is opened from a modal, close the modal when opening the iframe
            if (parent.currentDialogController) {
                parent._closeDialog();
            }
        });
        return;
    }
    core.action_registry.add('odoo_fin_connector', OdooFinConnector);
});
