odoo.define("web_studio.studio_home_menu_tests", function (require) {
    "use strict";

    const StudioHomeMenu = require("web_studio.StudioHomeMenu");
    const makeTestEnvironment = require("web.test_env");
    const testUtils = require("web.test_utils");

    const { Component, tags, useState } = owl;
    const { xml } = tags;

    QUnit.module("web_studio", {
        beforeEach() {
            this.props = {
                apps: [{
                    action: "121",
                    id: 1,
                    label: "Discuss",
                    parents: "",
                    webIcon: 'mail,static/description/icon.png',
                    webIconData: "/web_enterprise/static/src/img/default_icon_app.png",
                    xmlid: 'app.1',
                }, {
                    action: "122",
                    id: 2,
                    label: "Calendar",
                    parents: "",
                    webIcon: {
                        backgroundColor: "#C6572A",
                        color: "#FFFFFF",
                        iconClass: "fa fa-diamond",
                    },
                    xmlid: 'app.2',
                }, {
                    action: "123",
                    id: 3,
                    label: "Contacts",
                    parents: "",
                    webIcon: false,
                    webIconData: "/web_enterprise/static/src/img/default_icon_app.png",
                    xmlid: 'app.3',
                }],
            };
        }
    }, function () {
        QUnit.module("StudioHomeMenu");

        QUnit.test("simple rendering", async function (assert) {
            assert.expect(21);

            const studioHomeMenuProps = this.props;
            class Parent extends Component {
                constructor() {
                    super(...arguments);
                    this.studioHomeMenuProps = useState(studioHomeMenuProps);
                }
            }
            Parent.components = { StudioHomeMenu };
            Parent.template = xml`<StudioHomeMenu t-props="studioHomeMenuProps"/>`;

            const parent = new Parent();
            const target = testUtils.prepareTarget();
            target.classList.add('o_web_client', 'o_in_studio');
            await parent.mount(target);

            // Main div
            assert.hasClass(parent.el, 'o_home_menu');

            // Hidden elements
            assert.isNotVisible(parent.el.querySelector('.database_expiration_panel'),
                "Expiration panel should not be visible");
            assert.hasClass(parent.el, 'o_search_hidden');

            // App list
            assert.containsOnce(parent.el, 'div.o_apps');
            assert.containsN(parent.el, 'div.o_apps > a.o_app.o_menuitem', 4,
                "should contain 3 normal app icons + the new app button");

            // App with image
            const firstApp = parent.el.querySelector('div.o_apps > a.o_app.o_menuitem');
            assert.strictEqual(firstApp.dataset.menuXmlid, 'app.1');
            assert.containsOnce(firstApp, 'div.o_app_icon');
            assert.strictEqual(firstApp.querySelector('div.o_app_icon').style.backgroundImage,
                'url("/web_enterprise/static/src/img/default_icon_app.png")');
            assert.containsOnce(firstApp, 'div.o_caption');
            assert.strictEqual(firstApp.querySelector('div.o_caption').innerText, 'Discuss');
            assert.containsOnce(firstApp, '.o_web_studio_edit_icon i');

            // App with custom icon
            const secondApp = parent.el.querySelectorAll('div.o_apps > a.o_app.o_menuitem')[1];
            assert.strictEqual(secondApp.dataset.menuXmlid, 'app.2');
            assert.containsOnce(secondApp, 'div.o_app_icon');
            assert.strictEqual(secondApp.querySelector('div.o_app_icon').style.backgroundColor, 'rgb(198, 87, 42)',
                "Icon background color should be #C6572A");
            assert.containsOnce(secondApp, 'i.fa.fa-diamond');
            assert.strictEqual(secondApp.querySelector('i.fa.fa-diamond').style.color, 'rgb(255, 255, 255)',
                "Icon color should be #FFFFFF");
            assert.containsOnce(secondApp, '.o_web_studio_edit_icon i');

            // New app button
            assert.containsOnce(parent.el, 'div.o_apps > a.o_app.o_web_studio_new_app', 'should contain a "New App icon"');
            const newApp = parent.el.querySelector('a.o_app.o_web_studio_new_app');
            assert.strictEqual(newApp.querySelector('div.o_app_icon').style.backgroundImage, 'url("/web_studio/static/src/img/default_icon_app.png")',
                "Image source URL should end with '/web_studio/static/src/img/default_icon_app.png'");
            assert.containsOnce(newApp, 'div.o_caption');
            assert.strictEqual(newApp.querySelector('div.o_caption').innerText, 'New App');

            parent.destroy();
            target.classList.remove('o_web_client', 'o_in_studio');
        });

        QUnit.test("Click on a normal App", async function (assert) {
            assert.expect(3);

            const studioHomeMenuProps = this.props;
            class Parent extends Component {
                constructor() {
                    super(...arguments);
                    this.studioHomeMenuProps = useState(studioHomeMenuProps);
                }
                _onAppClicked(ev) {
                    assert.step('app-clicked');
                    assert.deepEqual(ev.detail, { action_id: "121", menu_id: 1 });
                }
            }
            Parent.components = { StudioHomeMenu };
            Parent.template = xml`<StudioHomeMenu t-props="studioHomeMenuProps" t-on-app-clicked.stop="_onAppClicked"/>`;

            const parent = new Parent();
            await parent.mount(testUtils.prepareTarget());

            await testUtils.dom.click(parent.el.querySelector('.o_menuitem'));

            assert.verifySteps(['app-clicked']);

            parent.destroy();
        });

        QUnit.test("Click on new App", async function (assert) {
            assert.expect(2);

            const studioHomeMenuProps = this.props;
            class Parent extends Component {
                constructor() {
                    super(...arguments);
                    this.studioHomeMenuProps = useState(studioHomeMenuProps);
                }
                _onNewApp(ev) {
                    assert.step('new-app');
                }
            }
            Parent.components = { StudioHomeMenu };
            Parent.template = xml`<StudioHomeMenu t-props="studioHomeMenuProps" t-on-new-app.stop="_onNewApp"/>`;

            const parent = new Parent();
            await parent.mount(testUtils.prepareTarget());

            const newApp = parent.el.querySelector('a.o_app.o_web_studio_new_app');
            await testUtils.dom.click(newApp);

            assert.verifySteps(['new-app']);

            parent.destroy();
        });

        QUnit.test("Click on edit icon button", async function (assert) {
            assert.expect(11);

            const studioHomeMenuProps = this.props;
            class Parent extends Component {
                constructor() {
                    super(...arguments);
                    this.studioHomeMenuProps = useState(studioHomeMenuProps);
                }
                _onReloadMenuData(ev) {
                    assert.step('reload_menu_data');
                    assert.ok(ev.detail && !!ev.detail.callback);
                    ev.detail.callback();
                }
            }
            Parent.components = { StudioHomeMenu };
            Parent.env = makeTestEnvironment({
                session: {
                    uid: 1,
                    warning: false,
                },
            });
            Parent.template = xml`
                <StudioHomeMenu
                    t-props="studioHomeMenuProps"
                    t-on-reload_menu_data.stop="_onReloadMenuData"
                />`;

            const parent = new Parent();
            await parent.mount(testUtils.prepareTarget());

            // TODO: we should maybe check icon visibility comes on mouse over

            const firstEditIconButton = parent.el.querySelector('.o_web_studio_edit_icon i');
            await testUtils.dom.click(firstEditIconButton);

            const dialog = document.querySelector('div.modal');
            assert.containsOnce(dialog, 'header.modal-header');
            assert.strictEqual(dialog.querySelector('header.modal-header h4').innerText, 'Edit Application Icon');

            assert.containsOnce(dialog, '.modal-content.o_web_studio_edit_menu_icon_modal .o_web_studio_icon_creator');

            assert.containsOnce(dialog, 'footer.modal-footer');
            assert.containsN(dialog, 'footer button', 2);

            const buttons = dialog.querySelectorAll('footer button');
            const firstButton = buttons[0];
            const secondButton = buttons[1];

            assert.strictEqual(firstButton.innerText, 'CONFIRM');
            assert.hasClass(firstButton, 'btn-primary');

            assert.strictEqual(secondButton.innerText, 'CANCEL');
            assert.hasClass(secondButton, 'btn-secondary');

            await testUtils.dom.click(secondButton);

            assert.strictEqual(document.querySelector('div.modal'), null);

            await testUtils.dom.click(firstEditIconButton);
            await testUtils.dom.click(document.querySelector('footer button'));

            assert.strictEqual(document.querySelector('div.modal'), null);

            parent.destroy();
        });
    });
});
