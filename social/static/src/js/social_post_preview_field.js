odoo.define('social.form_field_post_preview', function (require) {
"use strict";

var FieldHtml = require('web_editor.field.html');
var fieldRegistry = require('web.field_registry');
var MailEmojisMixin = require('mail.emoji_mixin');
var SocialPostFormatterMixin = require('social.post_formatter_mixin');

/**
 * Simple FieldHtml extension that will just wrap the emojis correctly.
 * See 'MailEmojisMixin' documentation for more information.
 */
var FieldPostPreview = FieldHtml.extend(MailEmojisMixin, SocialPostFormatterMixin, {
    _textToHtml: function (text) {
        var html = this._super.apply(this, arguments);
        var $html = $(html);
        var $previewMessage = $html.find('.o_social_preview_message');
        $previewMessage.html(this._formatPost($previewMessage.text().trim()));

        return $html[0].outerHTML;
    }
});

fieldRegistry.add('social_post_preview', FieldPostPreview);

return FieldPostPreview;

});
