odoo.define('voip/static/src/components/activity/activity_tests.js', function (require) {
'use strict';

const components = {
    Activity: require('mail/static/src/components/activity/activity.js'),
};

const {
    afterEach,
    beforeEach,
    start,
} = require('mail/static/src/utils/test_utils.js');

QUnit.module('voip', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('activity', {}, function () {
QUnit.module('activity_tests.js', {
    beforeEach() {
        beforeEach(this);

        this.createActivityComponent = async activity => {
            const ActivityComponent = components.Activity;
            ActivityComponent.env = this.env;
            this.component = new ActivityComponent(null, {
                activityLocalId: activity.localId,
            });
            await this.component.mount(this.widget.el);
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

QUnit.test('activity with phone number rendering', async function (assert) {
    assert.expect(7);

    await this.start();
    const onVoipActivityCall = (ev) => {
        assert.step('voip_call_triggered');
        assert.strictEqual(
            ev.detail.number,
            '+32470123456',
            "Voip call should be triggered with the phone number of the activity"
        );
        assert.strictEqual(
            ev.detail.activityId,
            100,
            "Voip call should be triggered with the id of the activity"
        );
    };
    document.addEventListener('voip_activity_call', onVoipActivityCall);
    const activity = this.env.models['mail.activity'].create({
        assignee: [['insert', {
            id: this.env.messaging.currentPartner.id,
        }]],
        canWrite: true,
        id: 100,
        phone: '+32470123456',
        type: [['insert', {
            displayName: 'Phone',
            id: 1,
        }]],
    });
    await this.createActivityComponent(activity);

    assert.containsOnce(
        document.body,
        '.o_Activity',
        "should have activity component"
    );
    assert.containsOnce(
        document.body,
        '.o_Activity_voipCall',
        "should have activity voip link"
    );
    assert.strictEqual(
        document.querySelector('.o_Activity_voipCall').textContent,
        "+32470123456",
        "activity voip link should contain activity phone number"
    );

    document.querySelector('.o_Activity_voipCall').click();
    assert.verifySteps(['voip_call_triggered'], "A voip call has to be triggered");
    document.removeEventListener('voip_activity_call', onVoipActivityCall);
});

});
});
});

});
