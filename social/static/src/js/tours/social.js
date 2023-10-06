odoo.define('social.tour', function (require) {
"use strict";

var core = require('web.core');
var tour = require('web_tour.tour');

var _t = core._t;

tour.register('social_tour', {
        url: "/web",
        rainbowManMessage: `<strong> ${_t('Congrats! Come back in a few minutes to check your statistics.')} </strong>`,
        sequence: 190,
    },
    [
        tour.stepUtils.showAppsMenuItem(),
        {
            trigger: '.o_app[data-menu-xmlid="social.menu_social_global"]',
            content: _t("Let's create your own <b>social media</b> dashboard."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: 'button.o_stream_post_kanban_new_stream',
            content: _t("Let's <b>connect</b> to Facebook, LinkedIn or Twitter."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: '.o_social_media_cards',
            content: _t("Choose which <b>account</b> you would like to link first."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: 'button.o_stream_post_kanban_new_stream',
            content: _t("Let's add <b>another stream</b> to get a better overview of this channel."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: '.o_social_add_stream_accounts',
            content: _t("Select the <b>account</b> you just added."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: '.o_field_widget[name="stream_type_id"]',
            content: _t("Choose the type of <b>stream</b> you would like to add."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: '.modal-footer .btn-primary',
            content: _t("Add it to your feed."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: 'button.o_stream_post_kanban_new_post',
            content: _t("Let's start posting."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: '.o_social_post_message_wrapper',
            content: _t("Write a message to get a preview of your post."),
            position: 'bottom',
            edition: 'enterprise',
        }, {
            trigger: 'button[name="action_post"]',
            extra_trigger: 'textarea[name="message"]:first:propValueContains()', // message field not empty
            content: _t("Happy with the result? Let's post it!"),
            position: 'bottom',
            edition: 'enterprise',
        },
    ]
);

});
