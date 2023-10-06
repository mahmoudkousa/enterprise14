odoo.define('web_studio.ReportEditorAction_tests', function (require) {
    "use strict";

    const { createActionManager, controlPanel } = require('web.test_utils');
    const { getPagerValue, pagerNext } = controlPanel;

    QUnit.module('Studio', {
        beforeEach: function () {
            this.data = {
                foo: {
                    fields: {},
                    records: [{ id: 22 }, { id: 23 }],
                },
                "ir.actions.report": {
                    fields: { model: { type: "char" } },
                    records: [{ id: 11, model: "foo" }],
                },
                "ir.model": {
                    fields: {},
                },
            };
        },
    }, function () {
        QUnit.module('ReportEditorAction');

        QUnit.test('use pager', async function (assert) {
            assert.expect(2);

            const reportHTML = `
                <html>
                    <head/>
                    <body>
                        <div id="wrapwrap">
                            <main>
                                <div class="page"/>
                            </main>
                        </div>
                    </body>
                </html>`;

            const actionManager = await createActionManager({
                data: this.data,
                async mockRPC(route) {
                    switch (route) {
                        case "/web_studio/get_report_views":
                            return { report_html: reportHTML };
                        case "/web_studio/get_widgets_available_options":
                        case "/web_studio/read_paperformat":
                            return {};
                        default:
                            return this._super(...arguments);
                    }
                },
            });

            await actionManager.doAction("web_studio.action_edit_report", {
                report: {
                    data: { report_name: "My Report" },
                    res_id: 11,
                },
            });

            assert.strictEqual(getPagerValue(actionManager), "1");
            await pagerNext(actionManager);
            assert.strictEqual(getPagerValue(actionManager), "2");

            actionManager.destroy();
        });
    });
});
