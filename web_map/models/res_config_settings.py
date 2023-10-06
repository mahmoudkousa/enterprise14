# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models,api, _
from odoo.exceptions import UserError
import requests
from odoo.http import request


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    map_box_token = fields.Char(config_parameter='web_map.token_map_box',string = 'Token Map Box', help='Necessary for some functionalities in the map view', copy=True, default='', store=True)

    def check_token_validity(self):
        url = 'https://api.mapbox.com/directions/v5/mapbox/driving/-73.989%2C40.733%3B-74%2C40.733?access_token='+self.map_box_token+'&steps=true&geometries=geojson'
        environ = request.httprequest.headers.environ
        if self.map_box_token != '':
            try:
                headers = {
                    'referer': environ.get('HTTP_REFERER')
                }
                result = requests.get(url=url, headers=headers)
                error_code = result.status_code
                if(result.status_code != 200):
                    self.map_box_token = ''
                    if error_code == 401:
                        raise UserError(_('The token input is not valid'))
                    elif error_code == 403:
                        raise UserError(_('This referer is not authorized'))
                    elif error_code == 500:
                        raise UserError(_('The MapBox server is unreachable'))
            except Exception:
                raise

    @api.model
    def set_values(self):
        # check validity of mapbox token only when it is being changed
        if self.map_box_token:
            map_box_token = self.env['ir.config_parameter'].get_param('web_map.token_map_box')
            if map_box_token != self.map_box_token:
                self.check_token_validity()
        super(ResConfigSettings, self).set_values()
