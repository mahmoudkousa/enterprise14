odoo.define('mail_enterprise/static/src/components/messaging_menu/messaging_menu_tests.js', function (require) {
'use strict';

const {
    afterEach,
    afterNextRender,
    beforeEach,
    start,
} = require('mail/static/src/utils/test_utils.js');

const { mock } = require('web.test_utils');

const { methods } = require('web_mobile.core');

QUnit.module('mail_enterprise', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('messaging_menu', {}, function () {
QUnit.module('messaging_menu_tests.js', {
    beforeEach() {
        beforeEach(this);

        this.start = async params => {
            const { env, widget } = await start(Object.assign(
                {
                    data: this.data,
                    hasMessagingMenu: true,
                },
                params,
            ));
            this.env = env;
            this.widget = widget;
        };
    },
    afterEach() {
        afterEach(this);
    },
});

QUnit.test("'backbutton' event should close messaging menu", async function (assert) {
    assert.expect(1);

    // simulate the feature is available on the current device
    mock.patch(methods, {
        overrideBackButton({ enabled }) {},
    });

    await this.start();
    await afterNextRender(() => document.querySelector('.o_MessagingMenu_toggler').click());

    await afterNextRender(() => {
        // simulate 'backbutton' event triggered by the mobile app
        const backButtonEvent = new Event('backbutton');
        document.dispatchEvent(backButtonEvent);
    });
    assert.doesNotHaveClass(
        document.querySelector('.o_MessagingMenu'),
        'o-is-open',
        "messaging menu should be closed after receiving the backbutton event"
    );

    // component must be destroyed before the overrideBackButton is unpatched
    afterEach(this);
    mock.unpatch(methods);
});

QUnit.test('[technical] messaging menu should properly override the back button', async function (assert) {
    assert.expect(4);

    // simulate the feature is available on the current device
    mock.patch(methods, {
        overrideBackButton({ enabled }) {
            assert.step(`overrideBackButton: ${enabled}`);
        },
    });

    await this.start({
        env: {
            device: {
                isMobile: true,
            },
        },
    });

    await afterNextRender(() =>
        document.querySelector('.o_MessagingMenu_toggler').click()
    );
    assert.verifySteps(
        ['overrideBackButton: true'],
        "the overrideBackButton method should be called with true when the menu is opened"
    );

    await afterNextRender(() =>
        document.querySelector('.o_MessagingMenu_toggler').click()
    );
    assert.verifySteps(
        ['overrideBackButton: false'],
        "the overrideBackButton method should be called with false when the menu is closed"
    );

    // component must be destroyed before the overrideBackButton is unpatched
    afterEach(this);
    mock.unpatch(methods);
});

});
});
});

});
