odoo.define("spreadsheet.DocumentsInspector", function (require) {
    "use strict";

    const DocumentsInspector = require("documents.DocumentsInspector");

    DocumentsInspector.include({
        events: _.extend(
            {
                "click .o_document_spreadsheet": "_onOpenSpreadSheet",
            },
            DocumentsInspector.prototype.events
        ),

        init: function (parent, params) {
            this._super(...arguments);
            for (const record of this.records) {
                this.recordsData[record.id].isSheet = record.data.handler === "spreadsheet";
            }
        },
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Compute the classes to use in DocumentsInspector.previews template
         *
         * @param {Object} record
         * @return {String}
         */
        _computeClasses: function (record) {
            let classes = this._super(...arguments);
            if (this.recordsData[record.id].isSheet) {
                classes = classes.replace(
                    "o_documents_preview_mimetype",
                    "o_documents_preview_image"
                );
            }
            return classes;
        },
        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------
        /**
         * Open the spreadsheet
         *
         * @private
         * @param {MouseEvent} ev
         */
        _onOpenSpreadSheet: function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const activeId = $(ev.currentTarget).data("id");
            if (activeId) {
                this.do_action({
                    type: "ir.actions.client",
                    tag: "action_open_spreadsheet",
                    params: {
                        active_id: activeId,
                    },
                });
            }
        },
    });
});
