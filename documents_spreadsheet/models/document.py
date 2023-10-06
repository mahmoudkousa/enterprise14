# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.exceptions import AccessError
from odoo.tools import image_process

class Document(models.Model):
    _inherit = 'documents.document'

    handler = fields.Selection([('spreadsheet', 'Spreadsheet')], ondelete={'spreadsheet': 'cascade'})
    raw = fields.Binary(related='attachment_id.raw', readonly=False)
    # TODO extend the versioning system to use raw.

    @api.model_create_multi
    def create(self, vals_list):
        default_folder = self.env.ref('documents_spreadsheet.documents_spreadsheet_folder', raise_if_not_found=False)
        if not default_folder:
            default_folder = self.env['documents.folder'].search([], limit=1, order="sequence asc")
        for vals in vals_list:
            if vals.get('handler') == 'spreadsheet':
                vals['folder_id'] = vals.get('folder_id', default_folder.id)
                if 'thumbnail' in vals:
                    vals['thumbnail'] = image_process(vals['thumbnail'], size=(80, 80), crop='center')
        documents = super().create(vals_list)
        for document in documents:
            if document.handler == 'spreadsheet':
                self.env['spreadsheet.contributor']._update(self.env.user, document)
        return documents

    def write(self, vals):
        for document in self:
            if 'mimetype' in vals and 'handler' not in vals:
                vals['handler'] = False
            if 'raw' in vals and document.handler == 'spreadsheet':
                self.env['spreadsheet.contributor']._update(self.env.user, document)
        return super().write(vals)

    @api.depends('checksum', 'handler')
    def _compute_thumbnail(self):
        # Spreadsheet thumbnails cannot be computed from their binary data.
        # They should be saved independently.
        spreadsheets = self.filtered(lambda d: d.handler == 'spreadsheet')
        super(Document, self - spreadsheets)._compute_thumbnail()

    @api.model
    def get_spreadsheets_to_display(self):
        Contrib = self.env["spreadsheet.contributor"]
        visible_docs = self.search([("handler", "=", "spreadsheet")])
        contribs = Contrib.search(
            [
                ("document_id", "in", visible_docs.ids),
                ("user_id", "=", self.env.user.id),
            ], order="last_update_date desc"
        )
        user_docs = contribs.document_id
        # keep only visible docs, but preserve order of contribs
        return (user_docs | visible_docs).read(["name"])

    def check_spreadsheet_access(self, operation: str, *, raise_exception=True):
        try:
            self.check_access_rights(operation)
            self.check_access_rule(operation)
        except AccessError as e:
            if raise_exception:
                raise e
            return False
        return True
