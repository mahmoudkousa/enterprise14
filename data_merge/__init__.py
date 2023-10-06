# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo.modules.db
from . import models

import logging
_logger = logging.getLogger(__name__)

def post_init(cr, registry):
    # if not registry.has_unaccent: # FIXME: odoo/odoo#347
    if not odoo.modules.db.has_unaccent(cr):
        _logger.warning('pg extension "unaccent" not loaded, deduplication rules of type "accent" will be treated as "exaxt"')
