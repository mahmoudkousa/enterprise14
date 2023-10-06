odoo.define('documents_spreadsheet.create_empty_sheet_tour', function (require) {
    'use strict';

    require('web.dom_ready');
    const tour = require('web_tour.tour');
    tour.register('spreadsheet_create_empty_sheet', {
        test: true,
    }, [
        {
            trigger: '.o_app[data-menu-xmlid="documents.menu_root"]',
            content: 'Open document app',
            run: 'click',
        },
        {
            trigger: '.o_documents_kanban_spreadsheet',
            content: 'Open template dialog',
            run: 'click',
        },
        {
            trigger: '.o-spreadsheet-create',
            content: 'Create new spreadsheet',
            run: 'click',
        },
        {
            trigger: 'span[title="Fill Color"]',
            content: 'Choose a color',
            run: 'click'
        },
        {
            trigger: '.o-color-picker .o-color-picker-line div[data-color="#990000"]',
            content: 'Choose a color',
            run: 'click'
        },
        {
            trigger: '.o_menu_brand',
            content: 'Go back to the menu',
            run: 'click'
        },
        {
            trigger: '.o_document_spreadsheet:first',
            content: 'Reopen the sheet',
            run: 'click'
        },
    ]);
});
