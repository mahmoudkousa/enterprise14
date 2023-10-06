odoo.define('mail_enterprise/static/src/components/attachment/attachment_tests.js', function (require) {
'use strict';

const components = {
    Attachment: require('mail/static/src/components/attachment/attachment.js'),
};
const {
    afterEach,
    afterNextRender,
    beforeEach,
    createRootComponent,
    start,
} = require('mail/static/src/utils/test_utils.js');

const { mock } = require('web.test_utils');

const { methods } = require('web_mobile.core');

QUnit.module('mail_enterprise', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('attachment', {}, function () {
QUnit.module('attachment_tests.js', {
    beforeEach() {
        beforeEach(this);

        this.createAttachmentComponent = async (attachment, otherProps) => {
            const props = Object.assign({ attachmentLocalId: attachment.localId }, otherProps);
            await createRootComponent(this, components.Attachment, {
                props,
                target: this.widget.el,
            });
        };

        this.start = async params => {
            const { env, widget } = await start(Object.assign({}, params, {
                data: this.data,
            }));
            this.env = env;
            this.widget = widget;
        };
    },
    afterEach() {
        afterEach(this);
    },
});

QUnit.test("'backbutton' event should close attachment viewer", async function (assert) {
    assert.expect(1);

    // simulate the feature is available on the current device
    mock.patch(methods, {
        overrideBackButton({ enabled }) {},
    });

    await this.start({
        env: {
            device: {
                isMobile: true,
            },
        },
        hasDialog: true,
    });
    const attachment = this.env.models['mail.attachment'].create({
        filename: "test.png",
        id: 750,
        mimetype: 'image/png',
        name: "test.png",
    });
    await this.createAttachmentComponent(attachment, {
        detailsMode: 'hover',
        isDownloadable: false,
        isEditable: false,
    });

    await afterNextRender(() => document.querySelector('.o_Attachment_image').click());
    await afterNextRender(() => {
        // simulate 'backbutton' event triggered by the mobile app
        const backButtonEvent = new Event('backbutton');
        document.dispatchEvent(backButtonEvent);
    });
    assert.containsNone(
        document.body,
        '.o_Dialog',
        "attachment viewer should be closed after receiving the backbutton event"
    );

    // component must be destroyed before the overrideBackButton is unpatched
    afterEach(this);
    mock.unpatch(methods);
});

QUnit.test('[technical] attachment viewer should properly override the back button', async function (assert) {
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
        hasDialog: true,
    });
    const attachment = this.env.models['mail.attachment'].create({
        filename: "test.png",
        id: 750,
        mimetype: 'image/png',
        name: "test.png",
    });
    await this.createAttachmentComponent(attachment, {
        detailsMode: 'hover',
        isDownloadable: false,
        isEditable: false,
    });

    await afterNextRender(() => document.querySelector('.o_Attachment_image').click());
    assert.verifySteps(
        ['overrideBackButton: true'],
        "the overrideBackButton method should be called with true when the attachment viewer is mounted"
    );

    await afterNextRender(() =>
        document.querySelector('.o_AttachmentViewer_headerItemButtonClose').click()
    );
    assert.verifySteps(
        ['overrideBackButton: false'],
        "the overrideBackButton method should be called with false when the attachment viewer is unmounted"
    );

    // component must be destroyed before the overrideBackButton is unpatched
    afterEach(this);
    mock.unpatch(methods);
});

});
});
});

});
