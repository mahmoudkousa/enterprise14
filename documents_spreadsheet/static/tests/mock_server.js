odoo.define('documents_spreadsheet.MockServer', function (require) {
    'use strict';

    const MockServer = require('web.MockServer');

    MockServer.include({
        async _performRpc(route, args) {
            if (args.method === "check_spreadsheet_access" && args.model === "documents.document") {
                // by default we have access for all arguments
                return true;
            }
            if (args.method === "check_spreadsheet_access" && args.model === "spreadsheet.template") {
                // by default we have access for all arguments
                return true;
            }
            return this._super(...arguments);
        }
    });
});