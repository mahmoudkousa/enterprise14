odoo.define('account_reports/static/tests/account_reports_tests', function (require) {
    "use strict";

    const ControlPanel = require('web.ControlPanel');
    const testUtils = require("web.test_utils");

    const { createActionManager, dom } = testUtils;

    QUnit.module('Account Reports', {}, () => {
        QUnit.test("mounted is called once when returning on 'Account Reports' from breadcrumb", async assert => {
            // This test can be removed as soon as we don't mix legacy and owl layers anymore.
            assert.expect(7);

            let mountCount = 0;

            ControlPanel.patch('test.ControlPanel', T => {
                class ControlPanelPatchTest extends T {
                    mounted() {
                        mountCount = mountCount + 1;
                        this.__uniqueId = mountCount;
                        assert.step(`mounted ${this.__uniqueId}`);
                        super.mounted(...arguments);
                    }
                    willUnmount() {
                        assert.step(`willUnmount ${this.__uniqueId}`);
                        super.mounted(...arguments);
                    }
                }
                return ControlPanelPatchTest;
            });

            const actionManager = await createActionManager({
                actions: [
                    {
                        id: 42,
                        name: "Account reports",
                        tag: 'account_report',
                        type: 'ir.actions.client',
                    },
                ],
                archs: {
                    'partner,false,form': '<form><field name="display_name"/></form>',
                    'partner,false,search': '<search></search>',
                },
                data: {
                    partner: {
                        fields: {
                            display_name: { string: "Displayed name", type: "char" },
                        },
                        records: [
                            {id: 1, display_name: "Genda Swami"},
                        ],
                    },
                },
                mockRPC: function (route) {
                    if (route === '/web/dataset/call_kw/account.report/get_report_informations') {
                        return Promise.resolve({
                            options: {},
                            buttons: [],
                            main_html: '<a action="go_to_details">Go to detail view</a>',
                        });
                    } else if (route === '/web/dataset/call_kw/account.report/go_to_details') {
                        return Promise.resolve({
                            type: "ir.actions.act_window",
                            res_id: 1,
                            res_model: "partner",
                            views: [
                                [false, "form"],
                            ],
                        });
                    } else if (route === '/web/dataset/call_kw/account.report/get_html_footnotes') {
                        return Promise.resolve("");
                    }
                    return this._super.apply(this, arguments);
                },
                intercepts: {
                    do_action: ev => actionManager.doAction(ev.data.action, ev.data.options),
                },
            });

            await actionManager.doAction(42);
            await dom.click(actionManager.$('a[action="go_to_details"]'));
            await dom.click(actionManager.$('.breadcrumb-item:first'));
            actionManager.destroy();

            assert.verifySteps([
                'mounted 1',
                'willUnmount 1',
                'mounted 2',
                'willUnmount 2',
                'mounted 3',
                'willUnmount 3',
            ]);

            ControlPanel.unpatch('test.ControlPanel');
        });
    });

});
