odoo.define('test_barcode_batch_flows.tour', function(require) {
'use strict';

const tour = require('web_tour.tour');
const helper = require('stock_barcode_picking_batch.tourHelper');

function checkState(state) {
    helper.assertPageSummary(state.pageSummary);
    helper.assertPreviousVisible(state.previous.isVisible);
    helper.assertPreviousEnabled(state.previous.isEnabled);
    helper.assertNextVisible(state.next.isVisible);
    helper.assertNextEnabled(state.next.isEnabled);
    helper.assertNextIsHighlighted(state.next.isHighlighted);
    helper.assertLinesCount(state.linesCount);
    helper.assertScanMessage(state.scanMessage);
    helper.assertPager(state.pager);
    helper.assertValidateVisible(state.validate.isVisible);
    helper.assertValidateIsHighlighted(state.validate.isHighlighted);
    helper.assertValidateEnabled(state.validate.isEnabled);
}

function updateState(oldState, newState) {
    const state = Object.assign({}, oldState, newState);
    const buttonNames = ['next', 'previous', 'validate'];
    for (const buttonName of buttonNames) {
        state[buttonName] = Object.assign({}, oldState[buttonName], newState[buttonName]);
    }
    return state;
}

const defaultViewState = {
    destLocationHighlight: false,
    locationHighlight: false,
    linesCount: 0,
    next: {
        isEnabled: false,
        isHighlighted: false,
        isVisible: false,
    },
    nextEnabled: false,
    nextIsHighlighted: false,
    nextVisible: false,
    pageSummary: '',
    pager: '0/0',
    previous: {
        isEnabled: false,
        isVisible: false,
    },
    scanMessage: '',
    validate: {
        isEnabled: false,
        isHighlighted: false,
        isVisible: false,
    },
};
let currentViewState;

// ----------------------------------------------------------------------------
// Tours
// ----------------------------------------------------------------------------
tour.register('test_barcode_batch_receipt_1', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            currentViewState = updateState(defaultViewState, {
                linesCount: 5,
                pager: '1/1',
                pageSummary: 'To WH/Stock',
                previous: {isVisible: true},
                scanMessage: 'scan_products',
                validate: {
                    isEnabled: true,
                    isVisible: true,
                },
            });
            checkState(currentViewState);
            const $linesFromFirstPicking = $(helper.getLines({index: [1, 4, 5]}));
            const $linesFromSecondPicking = $(helper.getLines({from: 2, to: 3}));
            helper.assertLinesBelongTo($linesFromFirstPicking, 'picking_receipt_1');
            helper.assertLinesBelongTo($linesFromSecondPicking, 'picking_receipt_2');
        },
    },

    //Check show information.
    {
        trigger: '.o_show_information',
    },
    {
        trigger: '.o_form_label:contains("State")',
    },
    {
        trigger: '.o_close',
    },
    {
        trigger: '.o_barcode_summary_location_dest:contains("Stock")',
    },

    // Scan product1 x4
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },
    {
        trigger: '.o_barcode_lines',
        run: function() {
            currentViewState.scanMessage = 'scan_more_dest';
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'product1'});
            helper.assert($lines.length, 2, "Expect 2 lines for product1");
            helper.assertLineIsHighlighted($lines, true);
            helper.assertLineQty($($lines[1]), '1');
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },
    {
        trigger: '.o_barcode_lines',
        run: function() {
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'product1'});
            helper.assert($lines.length, 2, "Expect 2 lines for product1");
            helper.assertLineIsHighlightedGreen($lines, true);
            helper.assertLineQty($($lines[0]), '1');
            helper.assertLineQty($($lines[1]), '3');
        }
    },

    // Scan one more time the product1 -> As no more quantity is expected, the last product1
    // line must still be highlighted in green and its quantity must still be at 3.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'product1'});
            helper.assert($lines.length, 2, "Expect 2 lines for product1");
            const $line1 = $($lines[0]);
            const $line2 = $($lines[1]);
            helper.assertLineQty($line1, '1');
            helper.assertLineIsHighlighted($line1, false);
            helper.assertLineQty($line2, '3');
            helper.assertLineIsHighlightedGreen($line2, true);
        }
    },

    // Scan productserial1
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productserial1'
    },
    {
        trigger: '.o_barcode_line.o_highlight[data-barcode="productserial1"]',
        run: function() {
            currentViewState.scanMessage = 'scan_lot';
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'productserial1'});
            helper.assert($lines.length, 2, "Expect 2 lines for productserial1");
            const $line1 = $($lines[0]);
            const $line2 = $($lines[1]);
            helper.assertLineQty($line1, '0');
            helper.assertLineIsHighlighted($line1, true);
            helper.assertLineQty($line2, '0');
            helper.assertLineIsHighlighted($line2, false);
        }
    },

    // Scan two serial numbers
    {
        trigger: '.o_barcode_client_action',
        run: 'scan SN-LHOOQ'
    },
    {
        trigger: '.o_line_lot_name:contains("SN-LHOOQ")',
        run: function() {
            currentViewState.scanMessage = 'scan_more_dest';
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'productserial1'});
            helper.assert($lines.length, 2, "Expect 2 lines for productserial1");
            const $line1 = $($lines[0]);
            const $line2 = $($lines[1]);
            helper.assertLineQty($line1, '0');
            helper.assertLineQty($line2, '1');
        }
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan SN-OQPAPT'
    },
    {
        trigger: '.o_line_lot_name:contains("SN-OQPAPT")',
        run: function() {
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'productserial1'});
            helper.assert($lines.length, 2, "Expect 2 lines for productserial1");
            const $line1 = $($lines[0]);
            const $line2 = $($lines[1]);
            helper.assertLineQty($line1, '1');
            helper.assertLineQty($line2, '1');
        }
    },

    // Scan productlot1
    {
        trigger: '.o_barcode_client_action',
        run: 'scan productlot1'
    },
    {
        trigger: '.o_barcode_lines',
        run: function() {
            currentViewState.scanMessage = 'scan_lot';
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'productlot1'});
            helper.assert($lines.length, 1, "Expect 1 lines for productlot1");
            const $line1 = $($lines[0]);
            helper.assertLineQty($line1, '0');
            helper.assertLineIsHighlighted($line1, true);
        }
    },

    // Scan lot0001 x4
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0001'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0001'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0001'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0001'
    },
    {
        trigger: '.o_barcode_line.o_highlight .qty-done:contains("4")',
        run: function() {
            currentViewState.scanMessage = 'scan_more_dest';
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'productlot1'});
            helper.assert($lines.length, 1, "Expect 1 lines for productlot1");
            const $line1 = $($lines[0]);
            helper.assertLineQty($line1, '4');
            helper.assertLineIsHighlighted($line1, true);
        },
    },
    // Open the view to add a line and close it immediately.
    {
        trigger: '.o_add_line',
    },
    {
        trigger: '.o_discard',
    },
    {
        trigger: '.o_validate_page',
        run: function() {
            checkState(currentViewState);
        },
    },

    // Create a new line for productlot1 with an another lot name...
    {
        trigger: '.o_add_line',
    },
    {
        trigger: ".o_field_widget[name=product_id] input",
        run: 'text productlot1',
    },
    {
        trigger: ".ui-menu-item > a:contains('productlot1')",
    },
    {
        trigger: "input.o_field_widget[name=qty_done]",
        run: 'text 0',
    },
    {
        trigger: ".o_field_widget[name=picking_id] input",
        run: 'text picking_receipt_2',
    },
    {
        trigger: ".ui-menu-item > a:contains('picking_receipt_2')",
    },
    {
        trigger: '.o_save',
    },
    {
        trigger: '.o_barcode_lines',
        run: function() {
            currentViewState.linesCount = 6;
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'productlot1'});
            helper.assert($lines.length, 2, "Expect 2 lines for productlot1");
            const $line1 = $($lines[0]);
            const $line2 = $($lines[1]);
            helper.assertLineQty($line1, '4'); // Previous line (4/8).
            helper.assertLineIsHighlighted($line1, false);
            helper.assertLineQty($line2, '0'); // New created line.
            helper.assertLineIsHighlighted($line2, false);
        },
    },

    // Scan productlot1...
    {
        trigger: '.o_barcode_line[data-barcode="productlot1"]',
        run: 'scan productlot1'
    },
    {
        trigger: '.o_barcode_line.o_highlight[data-barcode="productlot1"]',
        run: function() {
            currentViewState.scanMessage = 'scan_lot';
            checkState(currentViewState);
            const $lines =  helper.getLines({barcode: 'productlot1'});
            helper.assert($lines.length, 2, "Expect 2 lines for productlot1");
            const $line1 = $($lines[0]);
            const $line2 = $($lines[1]);
            helper.assertLineQty($line1, '4'); // Previous line (4/8).
            helper.assertLineIsHighlighted($line1, true);
            helper.assertLineQty($line2, '0'); // New created line.
            helper.assertLineIsHighlighted($line2, false);
        }
    },
    // ... then scan lot0002 x4
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0002'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0002'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0002'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan lot0002'
    },
    {
        trigger: '.o_barcode_line.o_highlight:contains("lot0002") .qty-done:contains("4")',
        run: function() {
            const $lines =  helper.getLines({barcode: 'productlot1'});
            helper.assert($lines.length, 2, "Expect 2 lines for productlot1");
            const $line1 = $($lines[0]);
            const $line2 = $($lines[1]);
            helper.assertLineQty($line1, '4');
            helper.assertLineIsHighlighted($line1, false);
            helper.assertLineQty($line2, '4');
            helper.assertLineIsHighlighted($line2, true);
        }
    },
]);

tour.register('test_barcode_batch_delivery_1', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            currentViewState = updateState(defaultViewState, {
                linesCount: 3,
                pager: '1/4',
                pageSummary: 'From WH/Stock/Section 1',
                next: {
                    isEnabled: true,
                    isVisible: true,
                },
                previous: {
                    isEnabled: true,
                    isVisible: true
                },
                scanMessage: 'scan_src',
            });
            checkState(currentViewState);
            const $lineFromPicking1 = helper.getLines({index: 1});
            const $linesFromPicking2 = helper.getLines({from: 2});
            helper.assertLineBelongTo($lineFromPicking1, 'picking_delivery_1');
            helper.assertLinesBelongTo($linesFromPicking2, 'picking_delivery_2');
        },
    },
    // Scan product1 x2, product4 x1
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product4'
    },

    {
        trigger: '.o_next_page.btn-primary',
        run: function () {
            currentViewState.next.isHighlighted = true;
            currentViewState.scanMessage = 'scan_more_src';
            checkState(currentViewState);
        },
    },

    // Change the location
    {
        trigger: '.o_next_page.btn-primary',
    },
    {
        trigger: '.o_next_page:not(.btn-primary)',
        run: function () {
            currentViewState.pageSummary = 'From WH/Stock/Section 2';
            currentViewState.linesCount = 1;
            currentViewState.next.isHighlighted = false;
            currentViewState.pager = '2/4';
            currentViewState.scanMessage = 'scan_src';
            checkState(currentViewState);
        },
    },

    // Scan product2 x2
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },

    {
        trigger: '.o_next_page.btn-primary',
        run: function () {
            currentViewState.next.isHighlighted = true;
            currentViewState.scanMessage = 'scan_more_src';
            checkState(currentViewState);
        },
    },

    // Change the location
    {
        trigger: '.o_next_page.btn-primary',
    },
    {
        trigger: '.o_next_page:not(.btn-primary)',
        run: function () {
            currentViewState.pageSummary = 'From WH/Stock/Section 3';
            currentViewState.linesCount = 2;
            currentViewState.next.isHighlighted = false;
            currentViewState.pager = '3/4';
            currentViewState.scanMessage = 'scan_src';
            checkState(currentViewState);
        },
    },

    // Scan product2 x1, product3 x2
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product3'
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product3'
    },

    {
        trigger: '.o_next_page.btn-primary',
        run: function () {
            currentViewState.next.isHighlighted = true;
            currentViewState.scanMessage = 'scan_more_src';
            checkState(currentViewState);
        },
    },

    // Change the location (shelf 4 is the last page).
    {
        trigger: '.o_next_page.btn-primary',
    },
    {
        trigger: '.o_validate_page',
        run: function () {
            currentViewState.pageSummary = 'From WH/Stock/Section 4';
            currentViewState.linesCount = 1;
            currentViewState.next.isEnabled = false;
            currentViewState.next.isHighlighted = false;
            currentViewState.next.isVisible = false;
            currentViewState.validate.isEnabled = true;
            currentViewState.validate.isVisible = true;
            currentViewState.pager = '4/4';
            currentViewState.scanMessage = 'scan_src';
            checkState(currentViewState);
        },
    },

    // Scan product4 x1
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product4'
    },

    {
        trigger: '.o_validate_page.btn-success',
        run: function () {
            currentViewState.validate.isHighlighted = true;
            currentViewState.scanMessage = 'scan_more_src';
            checkState(currentViewState);
        },
    },
]);

tour.register('test_batch_create', {test: true}, [
    {
        trigger: '.o_stock_barcode_main_menu:contains("Barcode Scanning")',
    },

    {
        trigger: '.button_batch_transfer',
    },

    {
        trigger: '.o-kanban-button-new',
    },

    {
        trigger: '.o_barcode_client_action',
        run: function () {
           const $pickingTypes = $('.o_barcode_picking_type');
           helper.assert($pickingTypes.length, 2, "Should contain Delivery Orders and Receipts");
        },
    },
    // select picking type
    {
        trigger: '.o_barcode_line_title:contains("Delivery Orders")'
    },

    {
        trigger: '.o_confirm'
    },

    // select 2 delivery orders
    {
        trigger: '.o_barcode_line_title:contains("picking_delivery_1")',
    },

    {
        trigger: '.o_barcode_line_title:contains("picking_delivery_2")',
    },

    {
        trigger: '.o_confirm'
    },

    // from here should be the same as test_barcode_batch_delivery_1 => just check that it initially looks the same
    {
        trigger: '.o_picking_label',
        run: function () {
            currentViewState = updateState(defaultViewState, {
                linesCount: 3,
                pager: '1/4',
                pageSummary: 'From WH/Stock/Section 1',
                next: {
                    isEnabled: true,
                    isVisible: true,
                },
                previous: {
                    isEnabled: true,
                    isVisible: true
                },
                scanMessage: 'scan_src',
            });
            checkState(currentViewState);
            const $lineFromPicking1 = helper.getLines({index: 1});
            const $linesFromPicking2 = helper.getLines({from: 2});
            helper.assertLineBelongTo($lineFromPicking1, 'picking_delivery_1');
            helper.assertLinesBelongTo($linesFromPicking2, 'picking_delivery_2');
        },
    },
]);

tour.register('test_put_in_pack_scan_suggested_package', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: function () {
            currentViewState = updateState(defaultViewState, {
                linesCount: 2,
                pager: '1/2',
                pageSummary: 'From WH/Stock/Section 1',
                next: {
                    isEnabled: true,
                    isVisible: true,
                },
                previous: {
                    isEnabled: true,
                    isVisible: true
                },
                scanMessage: 'scan_src',
            });
            checkState(currentViewState);
            const $lineFromPicking1 = helper.getLines({index: 1});
            const $linesFromPicking2 = helper.getLines({index: 2});
            helper.assertLineBelongTo($lineFromPicking1, 'test_delivery_1');
            helper.assertLinesBelongTo($linesFromPicking2, 'test_delivery_2');
        },
    },

    // Scans the delivery 1 line's product and put it in pack.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.pack',
    },
    {
        trigger: '.o_barcode_line:contains("test_delivery_1"):contains("PACK")',
        run: function() {
            const $lineFromPicking1 = $('.o_barcode_line:contains("test_delivery_1")');
            const product1_package = $lineFromPicking1.find('div[name="package"]').text().trim();
            helper.assert(product1_package, 'PACK0000001');
        }
    },

    // Scans the delivery 2 line's product and put it in pack.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product1',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.pack',
    },
    {
        trigger: '.o_barcode_line:contains("test_delivery_2"):contains("PACK")',
        run: function() {
            const $lineFromPicking2 = $('.o_barcode_line:contains("test_delivery_2")');
            const product2_package = $lineFromPicking2.find('div[name="package"]').text().trim();
            helper.assert(product2_package, 'PACK0000002');
        }
    },

    // Goes to next page and checks the lines have the right package suggestion.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-CMD.NEXT',
    },
    {
        trigger: '.o_barcode_client_action',
        run: function() {
            const $lineFromPicking1 = $('.o_barcode_line:contains("test_delivery_1")');
            const $lineFromPicking2 = $('.o_barcode_line:contains("test_delivery_2")');
            const package_suggestion1 = $lineFromPicking1.find('div[name="package"]').text().trim();
            const package_suggestion2 = $lineFromPicking2.find('div[name="package"]').text().trim();
            helper.assert(package_suggestion1, 'PACK0000001 ?');
            helper.assert(package_suggestion2, 'PACK0000002 ?');
        }
    },

    // Scans the delivery 1 line's product and put it in pack.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK0000001',
    },
    {
        trigger: '.o_barcode_line:contains("test_delivery_1"):contains("PACK")',
        run: function() {
            const $lineFromPicking1 = $('.o_barcode_line:contains("test_delivery_1")');
            const product1_package = $lineFromPicking1.find('div[name="package"]').text().trim();
            helper.assert(product1_package, 'PACK0000001');
        }
    },

    // Scans the delivery 2 line's product and put it in pack.
    {
        trigger: '.o_barcode_client_action',
        run: 'scan product2',
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan PACK0000002',
    },
    {
        trigger: '.o_barcode_line:contains("test_delivery_2"):contains("PACK")',
        run: function() {
            const $lineFromPicking2 = $('.o_barcode_line:contains("test_delivery_2")');
            const product2_package = $lineFromPicking2.find('div[name="package"]').text().trim();
            helper.assert(product2_package, 'PACK0000002');
        }
    },

    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },
    {
        trigger: '.o_notification.bg-success',
    },
]);

tour.register('test_pack_and_same_product_several_sml', {test: true}, [
    {
        trigger: '.o_barcode_client_action',
        run: 'scan P00001',
    },
    {
        trigger: '.qty-done:contains("3")',
        run: function() {
            const $lines =  helper.getLines({barcode: 'product1'});
            helper.assert($lines.length, 2);
            helper.assertLineIsHighlightedGreen($lines, true);
            helper.assertLineQty($($lines[0]), '3');
            helper.assertLineQty($($lines[1]), '7');
        },
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan P00001',
    },
    {
        trigger: '.o_notification.bg-danger',
        run: function () {
            helper.assertErrorMessage('This package is already scanned.');
        },
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan P00002',
    },
    {
        trigger: '.qty-done:contains("25")',
        run: function() {
            const $lines =  helper.getLines({barcode: 'product2'});
            helper.assert($lines.length, 2);
            helper.assertLineIsHighlightedGreen($lines, true);
            helper.assertLineQty($($lines[0]), '25');
            helper.assertLineQty($($lines[1]), '75');
        },
    },
    {
        trigger: '.o_barcode_client_action',
        run: 'scan O-BTN.validate',
    },
    {
        trigger: '.o_notification.bg-success',
    },
]);

});
