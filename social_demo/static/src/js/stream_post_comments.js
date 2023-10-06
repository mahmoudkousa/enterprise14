odoo.define('social_demo.social_post_kanban_comments', function (require) {

var StreamPostFacebookComments = require('social.social_facebook_post_kanban_comments');
var StreamPostTwitterComments = require('social.StreamPostTwitterComments');

/**
 * Return custom author image.
 * We use the 'profile_image_url_https' field to get a nicer demo effect.
 *
 * @param {string} comment
 */
var getDemoAuthorPictureSrc = function (comment) {
    if (comment) {
        return comment.from.profile_image_url_https;
    } else {
        return '/web/image/res.users/2/image_128';
    }
};

StreamPostFacebookComments.include({
    getAuthorPictureSrc: function () {
        return getDemoAuthorPictureSrc.apply(this, arguments);
    }
});

StreamPostTwitterComments.include({
    getAuthorPictureSrc: function () {
        return getDemoAuthorPictureSrc.apply(this, arguments);
    }
});

});
