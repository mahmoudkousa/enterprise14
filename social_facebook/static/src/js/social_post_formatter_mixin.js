odoo.define('social_facebook.post_formatter_mixin', function (require) {
"use strict";

var SocialPostFormatterMixin = require('social.post_formatter_mixin');
var _superFormatPost = SocialPostFormatterMixin._formatPost;

/*
 * Add Facebook @tag and #hashtag support.
 * Replace all occurrences of `#hashtag` and of `@tag` by a HTML link to a
 * search of the hashtag/tag on the media website
 */
SocialPostFormatterMixin._formatPost = function (formattedValue) {
    formattedValue = _superFormatPost.apply(this, arguments);
    var mediaType = SocialPostFormatterMixin._getMediaType.apply(this, arguments);

    if (mediaType === 'facebook' || mediaType === 'facebook_preview') {
        formattedValue = formattedValue.replace(/\B#([a-zA-Z\d-_]+)/g,
                `<a href='https://www.facebook.com/hashtag/$1' target='_blank'>#$1</a>`);

        if (mediaType !== 'facebook_preview') {
            var accountId = this.accountId || this.recordData.account_id.res_id;
            formattedValue = formattedValue.replace(/\B@\[([0-9]*)\]\s([\w\dÀ-ÿ-]+)/g,
                `<a href='/social_facebook/redirect_to_profile/` + encodeURIComponent(accountId) + `/$1?name=$2' target='_blank'>$2</a>`);
        }
    }
    return formattedValue;
};

});
