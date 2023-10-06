odoo.define('sale_subscription_dashboard.sale_subscription_report', function (require) {
"use strict";

var testUtils = require('web.test_utils');
var createActionManager = testUtils.createActionManager;

QUnit.module('Sale Subscription Dashboard Download Reports', {
    beforeEach: function () {
        this.actions = [{
            id: 1,
            data: {
                model: 'sale.subscription',
                output_format: 'pdf',
            },
            type: 'ir_actions_sale_subscription_dashboard_download',
        }];
    },
}, function () {

    QUnit.test('can execute sale subscription dashboard report download actions', async function (assert) {
        assert.expect(4);

        var actionManager = await createActionManager({
            actions: this.actions,
            mockRPC: function (route, args) {
                assert.step(args.method || route);
                return this._super.apply(this, arguments);
            },
            session: {
                get_file: function (params) {
                    assert.step(params.url);
                    assert.deepEqual(params.data, {
                        model: 'sale.subscription',
                        output_format: 'pdf',
                    }, "should give the correct data");
                    params.success();
                    params.complete();
                },
            },
        });
        await actionManager.doAction(1);
        assert.verifySteps(['/web/action/load', '/salesman_subscription_reports'],
        'Error while trying to execute download action sale subscription dashboard report download.');
        actionManager.destroy();
    });
});
});
