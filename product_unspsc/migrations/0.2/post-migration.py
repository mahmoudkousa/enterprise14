from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    """This code was added in the `product.unspsc.code.csv` file
    but that file is loaded only when the `product_unspsc` module is installed (by hook).
    Because of that, if the module was already installed when the patch was applied,
    they weren't added, so they need to be added manually."""

    env = api.Environment(cr, SUPERUSER_ID, {})
    field_names = ['id', 'code', 'name', 'applies_to', 'active']
    new_covid_sat_codes = [
        ['unspsc_code_85121811', '85121811',
         'Servicio de renta de equipo de laborario', 'product', '1'],
    ]
    ctx = {'current_module': 'product_unspsc', 'noupdate': True}
    res = env['product.unspsc.code'].with_context(ctx).load(
        field_names, new_covid_sat_codes)
