odoo.define('web_mobile.PivotRenderer', async function (require) {
    'use strict';

    const config = require('web.config');

    if (!config.device.isMobile) {
        return;
    }

    const PivotRenderer = require('web.PivotRenderer');


    PivotRenderer.patch("pivot_mobile", T => class extends T {
        /**
         * Do not compute the tooltip on mobile
         * @override 
         */
        _updateTooltip() { }

        /**
         * @override 
         */
        _getPadding(cell) {
            return 5 + cell.indent * 5;
        }

        /**
         * @override 
         */
        _onClickMenuGroupBy(field, interval, ev) {
            if (!ev.currentTarget.classList.contains('o_pivot_field_selection')){
                super._onClickMenuGroupBy(...arguments);
            } else {
                ev.stopPropagation();
            }
        }

    });
});