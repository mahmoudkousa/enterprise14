odoo.define("web_studio.home_menu_wrapper_tests", function (require) {
    "use strict";

    const HomeMenuWrapper = require("web_enterprise.HomeMenuWrapper");
    const testUtils = require("web.test_utils");

    QUnit.module("web_studio", {}, function () {
        QUnit.module("HomeMenuWrapper");

        QUnit.test("simple rendering", async function (assert) {
            assert.expect(6);

            const homeMenuManager = new HomeMenuWrapper(null, {
                menuData: {
                    apps: [],
                    menuItems: [],
                },
            });
            const target = testUtils.prepareTarget();
            await homeMenuManager.mount(target);

            assert.containsOnce(target, '.o_home_menu',
                "There should be only one home menu");
            assert.containsNone(homeMenuManager, '.o_web_studio_new_app',
                "There shouldn't be a new app icon");

            // Check styles applied to home menu
            homeMenuManager.state.style = 'background-image: url("/web_enterprise/static/src/img/home-menu-bg-overlay.svg");';
            await testUtils.nextTick();

            assert.strictEqual(homeMenuManager.el.style.backgroundImage,
                'url("/web_enterprise/static/src/img/home-menu-bg-overlay.svg")',
                "HomeMenu should display the given background image");

            // Check new app pushed
            homeMenuManager.state.apps.push({
                action: '121',
                id: 1,
                label: "MyApp",
                parents: "",
                webIcon: false,
                webIconData: "/web_enterprise/static/src/img/default_icon_app.png",
                xmlid: 'my.app',
            });
            await testUtils.nextTick();

            assert.containsOnce(homeMenuManager, '.o_app',
                "A new app should have appeared");

            homeMenuManager.state.studioMode = 'app_creator';
            await testUtils.nextTick();

            assert.containsOnce(target, '.o_home_menu',
                "There should be only one home menu");
            assert.containsOnce(homeMenuManager, '.o_web_studio_new_app',
                "There should be a new app icon");

            homeMenuManager.destroy();
        });
    });
});
