odoo.define('industry_fsm_sale.fsm_product_quantity', function (require) {
"use strict";

var FieldInteger = require('web.basic_fields').FieldInteger;

var core = require('web.core');
var field_registry = require('web.field_registry');
var qweb = core.qweb;

var _t = core._t;


/**
 * FSMProductQty is a widget to  get the FSM Product Quantity in product kanban view
 */
var FSMProductQty = FieldInteger.extend({
    description: _t("FSM Product Quantity"),
    template: "FSMProductQuantity",
    events: {
        'click .o_target_to_set': '_onKanbanTargetClicked',
    },

    /**
     * @override
     */
    init: function (parent, name, record, options) {
        this._super.apply(this, arguments);
        if (record.context.hide_qty_buttons) {
            this.isReadonly = true;
        }
    },

    /**
     * @private
     * @param {OdooEvent} e
     */
    _valueChange: function (target_name, value) {
        var target_name = target_name;
        var target_value = value;
        if (isNaN(target_value)) {
            this.do_warn(false, _t("Please enter an integer value"));
        } else {
            var changes = {};
            changes[target_name] = parseInt(target_value);
            this.trigger_up('field_changed', {
                dataPointID: this.dataPointID,
                changes: changes,
            });
        }
    },
    _onKanbanTargetClicked: function (e) {
        var self = this;
        var $target = $(e.currentTarget);
        var target_name = $target.attr('name');
        var target_value = $target.attr('value');

        const clickAddOneButton = self.$el.parents('.o_kanban_record.o_fsm_industry_product').find('button[data-name="fsm_add_quantity"].o_button_invisible');

        if (this.isReadonly) {
            return;
        }
        var $input = $('<input/>', {type: "text", class: 'o_input oe_inline d-inline-block text-center', style: "width: 40px; font-size: 24px", name: target_name});
        if (target_value) {
            $input.attr('value', target_value);
        }
        $input.on('keyup input', function (e) {
            if (e.which === $.ui.keyCode.ENTER) {
                $input.blur();
            }
        });
        $input.on('focus', function () {
            if (clickAddOneButton.length) {
                clickAddOneButton.addClass('d-none');
            }
        });
        $input.on('blur', function () {
            self._valueChange(target_name, $input.val());
            if (clickAddOneButton.length) {
                clickAddOneButton.removeClass('d-none');
            }
        });
        $input.replaceAll($target)
                .focus()
                .select();
    },
    /**
         * Render the widget when it is NOT edited.
     *
     * @override
     */
    _renderReadonly: function () {
        this.$el.html(qweb.render('FSMProductQuantity', {qty: this.recordData.fsm_quantity}));
    },
});

field_registry.add('fsmProductQuantity', FSMProductQty);

return {
    FSMProductQty: FSMProductQty,
};

});
