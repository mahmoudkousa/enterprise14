odoo.define('stock_barcode.LinesWidget', function (require) {
'use strict';

var core = require('web.core');
var Widget = require('web.Widget');

var QWeb = core.qweb;
var LinesWidget = Widget.extend({
    template: 'stock_barcode_lines_widget',
    events: {
        'click .o_add_line': '_onClickAddLine',
        'click .o_add_reserved': '_onClickAddReserved',
        'click .o_add_unit': '_onClickAddUnit',
        'click .o_barcode_line': '_onClickLine',
        'click .o_barcode_summary_location_src': '_onClickLocation',
        'click .o_barcode_summary_location_dest': '_onClickLocation',
        'click .o_destination_locations': '_onClickChangeDestinationLocation',
        'click .o_validate_page': '_onClickValidatePage',
        'click .o_next_page': '_onClickNextPage',
        'click .o_previous_page': '_onClickPreviousPage',
        'click .o_put_in_pack': '_onPutInPack',
        'click .o_remove_unit': '_onClickRemoveUnit',
        'click .o_source_locations': '_onClickChangeSourceLocation',
    },

    init: function (parent, page, pageIndex, nbPages) {
        this._super.apply(this, arguments);
        this.page = page;
        this.pageIndex = pageIndex;
        this.nbPages = nbPages;
        this.mode = parent.mode;
        this.groups = parent.groups;
        this.model = parent.actionParams.model;
        this.show_entire_packs = parent.show_entire_packs;
        this.requireLotNumber = parent.requireLotNumber;
        this.displayControlButtons = this.nbPages > 0 && parent._isControlButtonsEnabled();
        this.displayOptionalButtons = parent._isOptionalButtonsEnabled();
        this.isPickingRelated = parent._isPickingRelated();
        this.isImmediatePicking = parent.isImmediatePicking ? true : false;
        this.sourceLocations = parent.sourceLocations;
        this.destinationLocations = parent.destinationLocations;
        // detect if touchscreen (more complicated than one would expect due to browser differences...)
        this.istouchSupported = 'ontouchend' in document ||
                               'ontouchstart' in document ||
                               'ontouchstart' in window ||
                               navigator.maxTouchPoints > 0 ||
                               navigator.msMaxTouchPoints > 0;
    },

    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            return self._renderLines();
        });
    },
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Increment a product.
     *
     * @param {Number|string} id_or_virtual_id
     * @param {Number} qty
     * @param {string} model
     */
    incrementProduct: function(id_or_virtual_id, qty, model, doNotClearLineHighlight) {
        var $line = this.$("[data-id='" + id_or_virtual_id + "']");
        var incrementClass = (model === 'stock.inventory') ? '.product_qty': '.qty-done';
        var qtyDone = parseFloat($line.find(incrementClass).text());
        // increment quantity and avoid insignificant digits
        $line.find(incrementClass).text(parseFloat((qtyDone + qty).toPrecision(15)));
        this._highlightLine($line, doNotClearLineHighlight);

        this._handleControlButtons();
        this._updateIncrementButtons($line);

        if (qty === 0) {
            this._toggleScanMessage('scan_lot');
            this._highlightLotIcon($line);
        } else if (this.mode === 'receipt') {
            this._toggleScanMessage('scan_more_dest');
        } else if (['delivery', 'inventory'].indexOf(this.mode) >= 0) {
            this._toggleScanMessage('scan_more_src');
        } else if (this.mode === 'internal') {
            this._toggleScanMessage('scan_more_dest');
        } else if (this.mode === 'no_multi_locations') {
            this._toggleScanMessage('scan_products');
        }
    },

    /**
     * Called when the client action asks to add a line to the current page. Note that the client
     * action already has the new line in its current state. This method will render the template
     * of the new line and prepend it to the body of the current page.
     *
     * @param {Object} lineDescription: and object with all theinformation needed to render the
     *                 line's template, including the qty to add.
     */
    addProduct: function (lineDescription, model, doNotClearLineHighlight) {
        var $body = this.$el.filter('.o_barcode_lines');
        var $line = $(QWeb.render('stock_barcode_lines_template', {
            lines: [lineDescription],
            groups: this.groups,
            model: model,
            isPickingRelated: this.isPickingRelated,
            requireLotNumber: this.requireLotNumber,
        }));
        $body.prepend($line);
        $line.on('click', '.o_edit', this._onClickEditLine.bind(this));
        $line.on('click', '.o_package_content', this._onClickTruckLine.bind(this));
        this._updateIncrementButtons($line);
        this._highlightLine($line, doNotClearLineHighlight);

        this._handleControlButtons();

        if (lineDescription.qty_done === 0) {
            this._toggleScanMessage('scan_lot');
            this._highlightLotIcon($line);
        } else if (this.mode === 'receipt') {
            this._toggleScanMessage('scan_more_dest');
        } else if (['delivery', 'inventory'].indexOf(this.mode) >= 0) {
            this._toggleScanMessage('scan_more_src');
        } else if (this.mode === 'internal') {
            this._toggleScanMessage('scan_more_dest');
        } else if (this.mode === 'no_multi_locations') {
            this._toggleScanMessage('scan_products');
        }

    },

    highlightPackage: function (barcode) {
        var $line = this.$('.o_barcode_line:contains(' + barcode + ')');
        $line.length && this._highlightLine($line);
    },

    /**
     * Emphase the source location name in the summary bar
     *
     * @param {boolean} toggle: and object with all theinformation needed to render the
     */
    highlightLocation: function (toggle) {
        this.$('.o_barcode_summary_location_src').toggleClass('o_strong', toggle);
        this.$('.o_barcode_summary_location_dest').toggleClass('o_barcode_summary_location_highlight', toggle);
        this._toggleScanMessage('scan_products');
    },

    /**
    * Emphase the destination location name in the summary bar
    *
    * @param {boolean} toggle: set or not the property class
    */
    highlightDestinationLocation: function (toggle) {
        this.$('.o_barcode_summary_location_dest').toggleClass('o_strong', toggle);
        if (toggle === false) {
            return;
        }
        this._handleControlButtons();

        if (this.mode === 'receipt') {
            this._toggleScanMessage('scan_products');
        } else if (this.mode === 'internal') {
            this._toggleScanMessage('scan_src');
        }
    },

    /**
     * Removes the highlight on the lines.
     */
    clearLineHighlight: function () {
        var $body = this.$el.filter('.o_barcode_lines');
        // Remove the highlight from the other line + picking specific border if exists.
        $body.find('.o_highlight').removeClass('o_highlight').css("box-shadow", "");
    },

    /**
     * Set the lot name on a line.
     *
     * @param {Number|string} id_or_virtual_id
     * @param {string} lotName
     */
    setLotName: function(id_or_virtual_id, lotName) {
        var $line = this.$("[data-id='" + id_or_virtual_id + "']");
        var $lotName = $line.find('.o_line_lot_name');
        if (!$lotName.text()) {
            var $span = $('<span>', {class: 'o_line_lot_name', text: lotName});
            $lotName.replaceWith($span);
        }
    },

    getProductLines: function (lines) {
        // only applies to pickings
        if (this.show_entire_packs) {
            return this._sortProductLines(_.filter(lines, function (line) {
                return ! line.package_id;
            }));
        }

        if (this.model != 'stock.inventory') {
            // expects a picking (may fail otherwise)
            return this._sortProductLines(lines);
        } else {
            return lines;
        }
    },

    getPackageLines: function (lines) {
        if (! this.show_entire_packs) {
            return [];
        }

        lines = _.filter(lines, function (line) {
            return line.package_id;
        });
        var groupedLines = _.groupBy(lines, function (line) {
            return line.package_id[0] === line.result_package_id[0] && line.package_id[0];
        });
        var packageLines = [];
        for (var key in groupedLines) {
            // check if the package is 'reserved' to display '/ 1' on the line
            var reservedPackage = true;
            for (var index in groupedLines[key]) {
                if (groupedLines[key][index].product_uom_qty === 0){
                    reservedPackage = false;
                    break;
                }
            }
            if (groupedLines.hasOwnProperty(key)) {
                groupedLines[key][0].reservedPackage = reservedPackage;
                packageLines.push(groupedLines[key][0]);
            }
        }
        return packageLines;
    },
    /**
     * Get the current user interface states. Needed when the linesWidget is
     * reload in order to highlight location and display correct scan message
     */
    getState: function () {
        return {
            'highlightLocationSource': this.$('.o_barcode_summary_location_src').hasClass('o_barcode_summary_location_highlight'),
            'highlightDestinationLocation': this.$('.o_barcode_summary_location_dest').hasClass('o_barcode_summary_location_highlight'),
            'scan_message': this.$('.o_scan_message:not(.o_hidden)').attr('class').split('o_scan_message_')[1].split(' ')[0],
        };
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Called when user scans a usable package's barcode to pack current line.
     *
     * @param {integer} id_or_virtual_id
     * @param {Object} usablePackage
     */
    _applyPackage: function (id_or_virtual_id) {
        const lines = this.page.lines;
        const line = lines.find(l => id_or_virtual_id === (l.id || l.virtual_id));
        // Re-render all the barcode lines, then highlight the current line.
        this.$el.filter('.o_barcode_lines_header').empty();
        this.$el.filter('.o_barcode_lines').empty();
        this._renderLines();
        const $line = $(`.o_barcode_line[data-id=${(line.id || line.virtual_id)}]`);
        this._highlightLine($line);
    },

    /**
     * Return a list of the name of errors who could be in the barcode view.
     *
     * @private
     * @returns {Array<string>}
     */
    _getErrorName: function () {
        return [
            'picking_already_done',
            'picking_already_cancelled',
            'inv_already_done',
        ];
    },

    /**
     * Render the header and the body of this widget. It is called when rendering a page for the
     * first time. Once the page is rendered, the modifications will be made by `incrementProduct`
     * and `addProduct`. When another page should be displayed, the parent will destroy the current
     * instance and create a new one. This method will also toggle the display of the control
     * button.
     *
     * @private
     * @param {Object} linesDescription: description of the current page
     * @param {Number} pageIndex: the index of the current page
     * @param {Number} nbPages: the total number of pages
     */
     _renderLines: function () {
         if (this.mode === 'done') {
             if (this.model === 'stock.picking') {
                 this._toggleScanMessage('picking_already_done');
             } else if (this.model === 'stock.inventory') {
                 this._toggleScanMessage('inv_already_done');
             }
             return;
         } else if (this.mode === 'cancel') {
             this._toggleScanMessage('picking_already_cancelled');
             return;
         }

        // Render and append the page summary.
        var $header = this.$el.filter('.o_barcode_lines_header');
        var $pageSummary = $(QWeb.render('stock_barcode_summary_template', {
            locationName: this.page.location_name,
            locationDestName: this.page.location_dest_name,
            nbPages: this.nbPages,
            pageIndex: this.pageIndex + 1,
            mode: this.mode,
            model: this.model,
            isPickingRelated: this.isPickingRelated,
            sourceLocations: this.sourceLocations,
            destinationLocations: this.destinationLocations,
        }));
        $header.append($pageSummary);

        // Render and append the lines, if any.
        var $body = this.$el.filter('.o_barcode_lines');
        if (this.page.lines.length) {
            var $lines = $(QWeb.render('stock_barcode_lines_template', {
                lines: this.getProductLines(this.page.lines),
                packageLines: this.getPackageLines(this.page.lines),
                model: this.model,
                groups: this.groups,
                isPickingRelated: this.isPickingRelated,
                istouchSupported: this.istouchSupported,
                requireLotNumber: this.requireLotNumber,
            }));
            $body.prepend($lines);
            for (const line of $lines) {
                if (line.dataset) {
                    this._updateIncrementButtons($(line));
                }
            }
            $lines.on('click', '.o_edit', this._onClickEditLine.bind(this));
            $lines.on('click', '.o_package_content', this._onClickTruckLine.bind(this));
        }
        // Toggle and/or enable the control buttons. At first, they're all displayed and enabled.
        var $next = this.$('.o_next_page');
        var $previous = this.$('.o_previous_page');
        var $validate = this.$('.o_validate_page');
        if (this.nbPages === 1) {
            $next.prop('disabled', true);
            $previous.prop('disabled', true);
        }
        if (this.pageIndex + 1 === this.nbPages) {
            $next.toggleClass('o_hidden');
            $next.prop('disabled', true);
        } else {
            $validate.toggleClass('o_hidden');
        }

        if (! this.page.lines.length && this.model !== 'stock.inventory') {
            $validate.prop('disabled', true);
        }

        this._handleControlButtons();

        if (this.mode === 'receipt') {
            this._toggleScanMessage('scan_products');
        } else if (['delivery', 'inventory'].indexOf(this.mode) >= 0) {
            this._toggleScanMessage('scan_src');
        } else if (this.mode === 'internal') {
            this._toggleScanMessage('scan_src');
        } else if (this.mode === 'no_multi_locations') {
            this._toggleScanMessage('scan_products');
        }

         var $summary_src = this.$('.o_barcode_summary_location_src');
         var $summary_dest = this.$('.o_barcode_summary_location_dest');

         if (this.mode === 'receipt') {
             $summary_dest.toggleClass('o_barcode_summary_location_highlight', true);
         } else if (this.mode === 'delivery' || this.mode === 'internal') {
             $summary_src.toggleClass('o_barcode_summary_location_highlight', true);
         }
     },

    /**
     * Highlight and enable the control buttons according to the reservation processed on the page.
     *
     * @private
     */
    _handleControlButtons: function () {
        var $next = this.$('.o_next_page');
        var $validate = this.$('.o_validate_page');
        if (! $next.hasClass('o_hidden')) {
            this._highlightNextButtonIfNeeded();
        } else {
            $next.prop('disabled', true);
        }

        if (! $validate.hasClass('o_hidden')) {
            this._highlightValidateButtonIfNeeded();
        } else {
            $validate.prop('disabled', true);
        }
    },

    /**
     * Displays an help message at the bottom of the widget.
     *
     * @private
     * @param {string} message
     */
    _toggleScanMessage: function (message) {
        this.$('.o_scan_message').toggleClass('o_hidden', true);
        this.$('.o_scan_message_' + message).toggleClass('o_hidden', false);
        if (_.indexOf(this._getErrorName(), message) > -1) {
            this.$('.o_barcode_pic > .fa, .o_barcode_icon').toggleClass('d-none');
        }
        if (this.model != 'stock.inventory') {
            this._highlightNextExpected(message);
        }
    },

    /**
     * Highline the next expected action to aid in flow understanding
     * based on the current help message. For now this is implemented as:
     *  - highlight the next non-completed product
     *  - all messages except the 'scan_lot' message will do this since the lot icon
     *    to highlight is dependent on the last product scanned
     *
     * Note that products not part of original picking cannot ever be
     * "completed".
     *
     * @private
     * @param {string} message
     */
    _highlightNextExpected: function(message) {
        if (message != 'scan_lot') {
            this.$('.o_next_expected').removeClass('o_next_expected');
            if (! this._isReservationProcessed()) {
                const $lines = this.$('.o_barcode_line:not(.o_line_qty_completed)');
                for (const line of $lines) {
                    // do not include lines not part of original picking as "next_expected"
                    if ($(line).find('.o_barcode_scanner_qty').text().indexOf('/') != -1) {
                        $(line).find('.fa-tags').addClass('o_next_expected');
                        break;
                    }
                }
            }
        }
    },


    /**
     * Highline the lot/sn icon in $line. Needs to be separate from _highlightNextExpected
     *  so we know from which line to highlight the lot/sn icon.
     *
     * @private
     * @param {jQueryElement} $line
     */
    _highlightLotIcon: function ($line) {
        this.$('.o_next_expected').removeClass('o_next_expected');
        if ($line) {
            $line.find('.fa-barcode').addClass('o_next_expected');
        }
    },

    _isReservationProcessedLine: function ($line) {
        var qties = $line.find('.o_barcode_scanner_qty').text();
        qties = qties.split('/');
        if (parseInt(qties[0], 10) < parseInt(qties[1], 10)) {
            return -1;
        } else if (parseInt(qties[0], 10) === parseInt(qties[1], 10)) {
            return 0;
        } else {
            return 1;
        }
    },

    /**
     * Helper checking if the reservaton is processed on the page or not.
     *
     * @private
     * @returns {boolean} whether the reservation is processed on the page or not
     */
    _isReservationProcessed: function () {
        var self = this;
        var $lines = this.$('.o_barcode_line');
        if (! $lines.length) {
            return false;
        } else {
            var reservationProcessed = true;
            for (const line of $lines) {
                reservationProcessed = self._isReservationProcessedLine($(line));
                if (reservationProcessed === -1) {
                    reservationProcessed = false;
                    break;
                }
            }
            if (reservationProcessed === 0 || reservationProcessed === 1){
                reservationProcessed = true;
            }
            return reservationProcessed;
        }
    },

    /**
     * Highlight the nest button if needed.
     *
     * @private
     */
    _highlightNextButtonIfNeeded: function () {
        var $next = this.$('.o_next_page');
        var shouldHighlight;
        if ($next.prop('disabled') === true) {
            shouldHighlight = false;
        } else {
            shouldHighlight = this._isReservationProcessed();
        }
        if (shouldHighlight) {
            $next.prop('disabled', false);
            $next.toggleClass('btn-secondary', false);
            $next.toggleClass('btn-primary', true);
        } else {
            $next.toggleClass('btn-secondary', true);
            $next.toggleClass('btn-primary', false);
        }
        return shouldHighlight;
    },

    /**
     * Highlight the validate button if needed.
     *
     * @private
     */
    _highlightValidateButtonIfNeeded: function () {
        var $validate = this.$('.o_validate_page');
        var shouldHighlight;
        if ($validate.hasClass('o_hidden') === true) {
            shouldHighlight = false;
        } else {
            shouldHighlight = this._isReservationProcessed();
        }
        if (shouldHighlight) {
            // FIXME: is it my job?
            $validate.prop('disabled', false);
            $validate.toggleClass('btn-secondary', false);
            $validate.toggleClass('btn-success', true);
        } else {
            $validate.toggleClass('btn-secondary', true);
            $validate.toggleClass('btn-success', false);
        }
        return shouldHighlight;
    },

    /**
     * Scroll to `$line`.
     *
     * @private
     * @param {jQueryElement} $body
     * @param {jQueryElement} $line
     */
    _scrollToLine: function ($body, $line) {
        $body.animate({
            scrollTop: $body.scrollTop() + $line.position().top - $body.height() / 2 + $line.height() / 2
        }, 500);
    },

    /**
     * Highlight and scroll to a specific line in the current page after removing the highlight on
     * the other lines.
     *
     * @private
     * @param {Jquery} $line
     */
    _highlightLine: function ($line, doNotClearLineHighlight) {
        var $body = this.$el.filter('.o_barcode_lines');
        if (! doNotClearLineHighlight) {
            this.clearLineHighlight();
        }
        // Highlight `$line`.
        $line.toggleClass('o_highlight', true);
        $line.parents('.o_barcode_lines').toggleClass('o_js_has_highlight', true);

        var isReservationProcessed;
        if ($line.find('.o_barcode_scanner_qty').text().indexOf('/') === -1) {
            if (this.isPickingRelated && !this.isImmediatePicking) {
                isReservationProcessed = 1;  // product not part of initial transfer
            } else {
                isReservationProcessed = false; // there are no initial transfer products
            }
        } else {
            isReservationProcessed = this._isReservationProcessedLine($line);
        }
        if (isReservationProcessed === 1) {
            $line.toggleClass('o_highlight_green', false);
            $line.toggleClass('o_highlight_red', true);
        } else {
            $line.toggleClass('o_highlight_green', true);
            $line.toggleClass('o_highlight_red', false);
            if ($line.attr('data-picking-id')) {
                // determine picking specific color dynamically since border-color is set in template
                // we must use a more specific css value than 'border-color' for firefox for some reason
                $line.css("box-shadow", "inset 0px 0px 0px 3px " +  $line.css('border-top-color'));
            }
        }

        // don't move to done lines since they're at the bottom of list
        if (!$line.hasClass('o_line_completed')) {
            // Scroll to `$line`.
            this._scrollToLine($body, $line);
        }
    },

    /**
     * Updates the buttons to add quantities (updates written quantity or hides buttons).
     *
     * @private
     * @param {jQueryElement} $line
     */
    _updateIncrementButtons: function ($line) {
        const id = $line.data('id');
        const qtyDone = parseFloat($line.find('.qty-done').text());
        const line = this.page.lines.find(l => id === (l.id || l.virtual_id));
        if (this.model === 'stock.inventory') {
            const hideAddButton = Boolean(
                (line.product_id.tracking === 'serial' && (!line.prod_lot_id || line.product_qty > 0)) ||
                (line.product_id.tracking === 'lot' && !line.prod_lot_id));
            const hideRemoveButton = (line.product_qty < 1);
            $line.find('.o_add_unit') .toggleClass('d-none', hideAddButton);
            $line.find('.o_remove_unit') .toggleClass('d-none', hideRemoveButton);
        } else {
            if (line.product_uom_qty === 0) {
                // Does nothing it the line has no reserved quantity.
                return;
            }
            if (qtyDone < line.product_uom_qty) {
                const $button = $line.find('button[class*="o_add_"]');
                const qty = line.product_uom_qty - qtyDone;
                if (this.istouchSupported) {
                    // Updates the remaining quantities...
                    const $reservedButton = $button.filter('.o_add_reserved');
                    $button.data('reserved', qty);
                    $reservedButton.text(`+ ${qty}`);
                }
                else if (this.shiftPressed) {
                    // Updates the remaining quantities...
                    $button.data('reserved', qty);
                    $button.text(`+ ${qty}`);
                    $button.toggleClass('o_add_reserved', true);
                    $button.toggleClass('o_add_unit', false);
                } else {
                    $button.text(`+ 1`);
                    $button.toggleClass('o_add_unit', true);
                    $button.toggleClass('o_add_reserved', false);
                }
            } else {
                // hides the buttons since they are now useless.
                $line.find('.o_line_button').hide();
                // flag line so we know it doesn't need a shortcut key
                $line.addClass('o_line_qty_completed');
                if (!(line.product_id.tracking === 'serial' || line.product_id.tracking === 'lot') || line.lot_name ) {
                    // move line to bottom of list
                    $line.parent().append($line);
                    // class for css
                    $line.addClass('o_line_completed');
                }
            }
        }
    },

    /**
     * Sorting function for picking lines. This is designed to be extended for additional
     * sorting criteria. This function sorts by display_name. Unfortunately we cannot just have
     * a extendable compare function since this doesn't seem to work with the Odoo module system.
     *
     * @private
     */
    _sortProductLines: function (lines) {
        return lines.sort(function(a,b) {
            return a.display_name.localeCompare(b.display_name, {ignorePunctuation: true});
        });
    },

    /**
     * Handles visualization of increment buttons when shift button pushed
     *
     * @private
     */
    _applyShiftKeyDown: function () {
        if (! this.istouchSupported) {
            if (this.model === 'stock.inventory') {
                const addUnits = this.$el.find('.o_add_unit[shortcutKey]');
                const removeUnits = this.$el.find('.o_remove_unit[shortcutKey]');
                addUnits.find(":first-child").hide();
                addUnits.removeClass("o_shortcut_displayed");
                removeUnits.find(":first-child").show();
                removeUnits.addClass("o_shortcut_displayed");
            } else {
                this.shiftPressed = true;
                const lines = document.querySelectorAll('.o_barcode_line');
                for (const line of lines) {
                    this._updateIncrementButtons($(line));
                }
            }
        }
    },

    /**
     * Handles visualization of increment buttons when shift button released
     *
     * @private
     */
    _applyShiftKeyUp: function () {
        if (! this.istouchSupported) {
            if (this.model === 'stock.inventory') {
                const addUnits = this.$el.find('.o_add_unit[shortcutKey]');
                const removeUnits = this.$el.find('.o_remove_unit[shortcutKey]');
                addUnits.find(":first-child").show();
                addUnits.addClass("o_shortcut_displayed");
                removeUnits.find(":first-child").hide();
                removeUnits.removeClass("o_shortcut_displayed");
            } else {
                this.shiftPressed = false;
                const lines = document.querySelectorAll('.o_barcode_line');
                for (const line of lines) {
                    this._updateIncrementButtons($(line));
                }
            }
        }
    },


    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handles the click on the "Add Unit" button. This will trigger up
     * `abstract_client_action` `_incrementLines` method.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onClickAddUnit: function (ev) {
        ev.preventDefault();
        const $line = $(ev.target).parents('.o_barcode_line');
        const id = $line.data('id');
        this.trigger_up('increment_line', {id: id});
    },

    /**
     * Handles the click on the "Add Remaining Reserved Quantity" button.
     * This will trigger up `abstract_client_action` `_incrementLines` method.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onClickAddReserved: function (ev) {
        ev.preventDefault();
        const $line = $(ev.target).parents('.o_barcode_line');
        const id = $line.data('id');
        const reserved_qty = $line.find('[data-reserved]').data('reserved');
        this.trigger_up('increment_line', {
            id: id,
            qty: reserved_qty,
        });
    },

    /**
     * Handles the click on a location to change the destination location.
     * Will trigger up the `picking_client_action` `_changeLocation`.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onClickChangeDestinationLocation: function (ev) {
        const locationId = Number(ev.target.dataset.locationId);
        this.trigger_up('change_location', {
            locationId: locationId,
            isSource: false,
        });
    },

    /**
     * Handles the click on a location to change the source location.
     * Will trigger up the `picking_client_action` `_changeLocation`.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onClickChangeSourceLocation: function (ev) {
        const locationId = Number(ev.target.dataset.locationId);
        this.trigger_up('change_location', {
            locationId: locationId,
            isSource: true,
        });
    },

    /**
     * Handles the click on the page's source or destination location to display the location list.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onClickLocation: function (ev) {
        ev.stopPropagation();
        if (!this.isPickingRelated) {
            return;
        }
        let target = ev.target;
        if (!target.classList.contains('o_clickable')) {
            target = $(target).parents('.o_clickable')[0];
        }
        // Looks if user clicked on source or destination location...
        const isSource = target.classList.contains('o_barcode_summary_location_src');
        const locationsToDisplay = isSource ? '.o_source_locations' : '.o_destination_locations';
        const locationsToHide = isSource ? '.o_destination_locations' : '.o_source_locations';
        // ... then force to hide the other locations list and display the wanted list.
        $(locationsToHide).toggleClass('d-none', true);
        const $dest_location_list = $(locationsToDisplay);
        const hideLocationDest = function () {
            $(locationsToDisplay).toggleClass('d-none', true);
            window.removeEventListener('click', hideLocationDest);
        };
        $dest_location_list.toggleClass('d-none');
        window.addEventListener('click', hideLocationDest);
    },

    /**
     * Handles the click on a line to select this line.
     */
    _onClickLine: function (ev) {
        let $target = $(ev.target);
        if (!$target.hasClass('o_barcode_line')) {
            // Gets the line if it was one of its children whom was clicked on.
            $target = $target.parents('.o_barcode_line');
        }
        this._highlightLine($target);
    },

    /**
     * Handles the click on the `validate button`.
     *
     * @private
     * @param {MouseEvent} ev
     */
     _onClickValidatePage: function (ev) {
        ev.stopPropagation();
        this.trigger_up('validate');
    },

    /**
     * Handles the click on the `add a product button`.
     *
     * @private
     * @param {MouseEvent} ev
     */
     _onClickAddLine: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.trigger_up('add_line');
    },

    /**
     * Handles the click on the `edit button` on a line.
     *
     * @private
     * @param {jQuery.Event} ev
     */
    _onClickEditLine: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var id = $(ev.target).parents('.o_barcode_line').data('id');
        this.trigger_up('edit_line', {id: id});
    },

    /**
     * Handles the click on the `next button`.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickNextPage: function (ev) {
        ev.stopPropagation();
        this.trigger_up('next_page');
    },

    /**
     * Handles the click on the `previous button`.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickPreviousPage: function (ev) {
        ev.stopPropagation();
        this.trigger_up('previous_page');
    },

    /**
     * Handles the click on the "Remove Unit" button. This will trigger up
     * `abstract_client_action` `_incrementLines` method but with negative value.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onClickRemoveUnit: function (ev) {
        ev.preventDefault();
        const $line = $(ev.target).parents('.o_barcode_line');
        const id = $line.data('id');
        this.trigger_up('increment_line', {
            id: id,
            qty: -1,
        });
    },

    /**
     * Handles the click on the `package content button`.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickTruckLine: function (ev) {
        ev.stopPropagation();
        var id = $(ev.target).parents('.o_barcode_line').data('id');
        this.trigger_up('open_package', {id: id});
    },

    /**
     * Handles the click on the `put in pack button`.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onPutInPack: function (ev) {
        ev.stopPropagation();
        this.trigger_up('put_in_pack');
    },
});

return LinesWidget;

});
