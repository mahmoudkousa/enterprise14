odoo.define('pos_iot.chrome', function(require) {
    'use strict';

    const Chrome = require('point_of_sale.Chrome');
    const Registries = require('point_of_sale.Registries');

    const PosIotChrome = Chrome =>
        class extends Chrome {
            get clientScreenButtonIsShown() {
                return super.clientScreenButtonIsShown && this.env.pos.iot_device_proxies.display;
            }
        };

    Registries.Component.extend(Chrome, PosIotChrome);

    return Chrome;
});
