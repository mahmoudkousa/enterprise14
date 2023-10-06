odoo.define('stock_barcode.MrpSubcontractingLinesWidget', function (require) {
'use strict';

var LinesWidget = require('stock_barcode.LinesWidget');

var MrpSubcontractingLinesWidget = LinesWidget.include({
    events: _.extend({}, LinesWidget.prototype.events, {
        'click .o_mrp_subcontracting': '_onClickRecordComponents',
        'click .o_show_subcontract_details': '_onClickShowSubcontractDetails',
    }),

    init: function (parent, page, pageIndex, nbPages) {
        this._super.apply(this, arguments);
        this.display_action_record_components = parent.currentState.display_action_record_components;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handles the click on the `Quality Checks` button.
     *
     * @private
     * @param {MouseEvent} ev
     */
     _onClickShowSubcontractDetails: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var move_id = $(ev.target).parents('.o_barcode_line_actions').data('move_id');
        this.trigger_up('action_show_subcontract_details', {move_id: move_id});
    },

    /**
     * Handles the click on the `Record Components` button.
     *
     * @private
     * @param {MouseEvent} ev
     */
     _onClickRecordComponents: function (ev) {
        ev.stopPropagation();
        this.trigger_up('action_record_components');
    },
});

return MrpSubcontractingLinesWidget;

});
