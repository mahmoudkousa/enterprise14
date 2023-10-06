odoo.define('social_linkedin.social_linkedin_post_kanban_comments', function (require) {

var core = require('web.core');
var _t = core._t;
var QWeb = core.qweb;
var StreamPostComments = require('social.social_post_kanban_comments');


var StreamPostLinkedInComments = StreamPostComments.extend({
    init: function (parent, options) {
        this.options = _.defaults(options || {}, {
            title: _t('LinkedIn Comments'),
            commentName: _t('comment/reply')
        });

        this.postAuthorImage = options.postAuthorImage;
        this.currentUserUrn = options.currentUserUrn;
        this.totalLoadedComments = options.comments.length;
        this.offset = options.offset;
        this.summary = options.summary;

        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    getAuthorPictureSrc: function (comment) {
        return comment ? comment.from.picture : this.postAuthorImage;
    },

    getCommentLink: function (comment) {
        let activityUrn = comment.id.split('(')[1].split(',')[0];
        return `https://www.linkedin.com/feed/update/${encodeURIComponent(activityUrn)}?commentUrn=${encodeURIComponent(comment.id)}`;
    },

    getAuthorLink: function (comment) {
        if (comment.from.isOrganization) {
            return `https://www.linkedin.com/company/${encodeURIComponent(comment.from.vanityName)}`;
        }
        return `https://www.linkedin.com/in/${encodeURIComponent(comment.from.vanityName)}`;
    },

    isCommentEditable: function (comment) {
        return false;
    },

    isCommentLikable: function (comment) {
        return false;
    },

    isCommentDeletable: function (comment) {
        return comment.from.id === this.currentUserUrn;
    },

    canAddImage: function () {
        return false;
    },

    getAddCommentEndpoint: function () {
        return '/social_linkedin/comment';
    },

    getDeleteCommentEndpoint: function () {
        return 'delete_linkedin_comment';
    },

    showMoreComments: function (result) {
        return this.totalLoadedComments < this.summary.total_count;
    },

    // --------------------------------------------------------------------------
    // Handlers
    // --------------------------------------------------------------------------

    _onLikeComment: function (ev) {
        // We don't support the like feature since we have no efficient way
        // of knowing if a post is already liked or not by the organization page
        ev.preventDefault();
    },

    _onLoadMoreComments: function (ev) {
        var self = this;
        ev.preventDefault();

        this._rpc({
            model: 'social.stream.post',
            method: 'get_linkedin_comments',
            args: [[this.postId], null, this.offset]
        }).then(function (result) {
            var $moreComments = $(QWeb.render("social.StreamPostCommentsWrapper", {
                widget: self,
                comments: result.comments
            }));
            self.$('.o_social_comments_messages').append($moreComments);

            self.totalLoadedComments += result.comments.length;
            if (self.totalLoadedComments >= self.summary.total_count) {
                self.$('.o_social_load_more_comments').hide();
            }

            self.offset = result.offset;
        });
    },

    /*
     * Dynamically load the replies under the comment
     * because we need one HTTP request to do it.
     */
    _onLoadReplies: function (ev) {
        ev.preventDefault();
        if (this.originalPost.mediaType === 'linkedin') {
            var $target = $(ev.currentTarget);
            var data = $target.data('innerComments');

            var self = this;
            var superArguments = arguments;
            var superMethod = this._super;

            return this._rpc({
                model: 'social.stream.post',
                method: 'get_linkedin_comments',
                args: [[this.postId], data.parentUrn]
            }).then(function (result) {
                $target.data('innerComments', result.comments);
                return superMethod.apply(self, superArguments);
            });
        } else {
            return this._super.apply(this, arguments);
        }
    },
});

return StreamPostLinkedInComments;

});
