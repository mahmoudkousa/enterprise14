odoo.define('social.kanban_field_stream_post', function (require) {
"use strict";

var FieldRegistry = require('web.field_registry');
var FieldText = require('web.basic_fields').FieldText;
var MailEmojisMixin = require('mail.emoji_mixin');
var SocialStreamPostFormatterMixin = require('social.post_formatter_mixin');

var SocialKanbanMessageWrapper = FieldText.extend(MailEmojisMixin, SocialStreamPostFormatterMixin, {
    /**
     * Overridden to wrap emojis and apply special stream post formatting
     *
     * @override
     */
    _render: function () {
        if (this.value) {
            this.$el.html(this._formatPost(this.value));
        }
    },
});

FieldRegistry.add('social_kanban_field_stream_post', SocialKanbanMessageWrapper);

return SocialKanbanMessageWrapper;

});
