odoo.define('web_mobile.barcodes.desktop.tests', function (require) {
    "use strict";

    const field_registry = require('web.field_registry');
    const FormView = require('web.FormView');
    const relational_fields = require('web.relational_fields');
    const testUtils = require('web.test_utils');

    const barcode_fields = require('web_mobile.barcode_fields');
    const mobile = require('web_mobile.core');

    const { createView } = testUtils;

    const NAME_SEARCH = "name_search";
    const PRODUCT_PRODUCT = 'product.product';
    const SALE_ORDER_LINE = 'sale_order_line';
    const PRODUCT_FIELD_NAME = 'product_id';
    const ARCHS = {
        'product.product,false,list': `<tree>
                <field name="display_name"/>
        </tree>`,
        'product.product,false,search': `<search></search>`,
    };

    QUnit.module('web_mobile', {
        beforeEach() {
            this.data = {
                [PRODUCT_PRODUCT]: {
                    fields: {
                        id: {type: 'integer'},
                        name: {},
                        barcode: {},
                    },
                    records: [{
                        id: 111,
                        name: 'product_cable_management_box',
                        barcode: '601647855631',
                    }]
                },
                [SALE_ORDER_LINE]: {
                    fields: {
                        id: {type: 'integer'},
                        [PRODUCT_FIELD_NAME]: {
                            string: PRODUCT_FIELD_NAME,
                            type: 'many2one',
                            relation: PRODUCT_PRODUCT
                        },
                    }
                },
            };
        },
    }, function () {

        QUnit.test("web_mobile: barcode button in a mobile environment", async function (assert) {
            assert.expect(3);

            // simulate a mobile environment
            field_registry.add('many2one_barcode', barcode_fields);

            testUtils.mock.patch(mobile.methods, {
                scanBarcode: () => Promise.resolve({
                    'data': this.data[PRODUCT_PRODUCT].records[0].barcode,
                }),
                showToast:  () => {},
                vibrate:  () => {},
            });

            const form = await createView({
                View: FormView,
                arch: `
                    <form>
                        <sheet>
                            <field name="${PRODUCT_FIELD_NAME}" widget="many2one_barcode"/>
                        </sheet>
                    </form>`,
                data: this.data,
                model: SALE_ORDER_LINE,
                archs: ARCHS,
                mockRPC(route, args) {
                    if (args.method === NAME_SEARCH && args.model === PRODUCT_PRODUCT) {
                        return this._super(...arguments).then(result => {
                            const records = this
                                .data[PRODUCT_PRODUCT]
                                .records
                                .filter(record => record.barcode === args.kwargs.name)
                                .map(record => [record.id, record.name])
                            ;
                            return records.concat(result);
                        });
                    }
                    return this._super(...arguments);
                },
            });

            const $scanButton = form.$('.o_barcode_mobile');

            assert.containsOnce(form, $scanButton, "has scanner button");

            await testUtils.dom.click($scanButton);

            const $modal = $('.modal-dialog.modal-lg');
            assert.containsOnce($('body'), $modal, 'there should be one modal opened in full screen');

            await testUtils.dom.click($modal.find('.o_list_view .o_data_row:first'));

            const selectedId = form.renderer.state.data[PRODUCT_FIELD_NAME].res_id;
            assert.equal(selectedId, this.data[PRODUCT_PRODUCT].records[0].id,
                `product found and selected (${this.data[PRODUCT_PRODUCT].records[0].barcode})`);

            testUtils.mock.unpatch(mobile.methods);
            field_registry.add('many2one_barcode', relational_fields.FieldMany2One);

            form.destroy();
        });
    });
});
