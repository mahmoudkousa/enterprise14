# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64

from freezegun import freeze_time

from odoo.exceptions import AccessError
from odoo.tests import Form
from odoo.tests.common import SavepointCase, new_test_user

TEXT = base64.b64encode(bytes("TEST", 'utf-8'))
GIF = b"R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs="

class SpreadsheetDocuments(SavepointCase):

    @classmethod
    def setUpClass(cls):
        super(SpreadsheetDocuments, cls).setUpClass()
        cls.folder = cls.env["documents.folder"].create({"name": "Test folder"})

    def test_spreadsheet_to_display(self):
        document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        archived_document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "active": False,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        spreadsheets = self.env["documents.document"].get_spreadsheets_to_display()
        spreadsheet_ids = [s["id"] for s in spreadsheets]
        self.assertTrue(document.id in spreadsheet_ids, "It should contain the new document")
        self.assertFalse(archived_document.id in spreadsheet_ids, "It should not contain the archived document")

    def test_spreadsheet_to_display_create_order(self):
        with freeze_time('2020-02-02 18:00'):
            spreadsheet1 = self.env["documents.document"].create({
                "raw": r"{}",
                "folder_id": self.folder.id,
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            })
        with freeze_time('2020-02-15 18:00'):
            spreadsheet2 = self.env["documents.document"].create({
                "raw": r"{}",
                "folder_id": self.folder.id,
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            })
        spreadsheets = self.env["documents.document"].get_spreadsheets_to_display()
        # import pdb; pdb.set_trace()
        spreadsheet_ids = [s["id"] for s in spreadsheets]
        self.assertEqual(spreadsheet_ids, [spreadsheet2.id, spreadsheet1.id])

    def test_spreadsheet_to_display_write_order(self):
        with freeze_time('2020-02-02 18:00'):
            spreadsheet1 = self.env["documents.document"].create({
                "raw": r"{}",
                "folder_id": self.folder.id,
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            })
        with freeze_time('2020-02-15 18:00'):
            spreadsheet2 = self.env["documents.document"].create({
                "raw": r"{}",
                "folder_id": self.folder.id,
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            })
        spreadsheet1.raw = "data"
        spreadsheets = self.env["documents.document"].get_spreadsheets_to_display()
        spreadsheet_ids = [s["id"] for s in spreadsheets]
        self.assertEqual(spreadsheet_ids, [spreadsheet1.id, spreadsheet2.id])

    def test_spreadsheet_to_display_without_contrib(self):
        user = new_test_user(self.env, login="Jean", groups="documents.group_documents_user")
        with freeze_time('2020-02-02 18:00'):
            spreadsheet1 = self.env["documents.document"].with_user(user).create({
                "raw": r"{}",
                "folder_id": self.folder.id,
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            })
        with freeze_time('2020-02-15 18:00'):
            spreadsheet2 = self.env["documents.document"].create({
                "raw": r"{}",
                "folder_id": self.folder.id,
                "handler": "spreadsheet",
                "mimetype": "application/o-spreadsheet",
            })
        spreadsheets = self.env["documents.document"].with_user(user).get_spreadsheets_to_display()
        spreadsheet_ids = [s["id"] for s in spreadsheets]
        self.assertEqual(spreadsheet_ids, [spreadsheet1.id, spreadsheet2.id])

    def test_spreadsheet_to_display_access_portal(self):
        portal = new_test_user(self.env, "Test user", groups='base.group_portal')
        with self.assertRaises(AccessError, msg="A portal user should not be able to read spreadsheet"):
            self.env["documents.document"].with_user(portal).get_spreadsheets_to_display()

    def test_spreadsheet_to_display_access_ir_rule(self):
        user = new_test_user(self.env, "Test user", groups='documents.group_documents_manager')

        model = self.env.ref('documents.model_documents_document')
        group = self.env.ref('documents.group_documents_manager')

        manager_doc = self.env["documents.document"].with_user(user).create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        visible_doc = self.env["documents.document"].with_user(user).create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        # archive existing record rules which might allow access (disjunction between record rules)
        record_rules = self.env['ir.rule'].search([
            ('model_id', '=', model.id),
        ])
        record_rules.active = False
        self.env['ir.rule'].create({
            'name': 'test record rule',
            'model_id': model.id,
            'groups': [(4, group.id)],
            'domain_force': f"[('id', '=', {visible_doc.id})]",  # always rejects
        })

        spreadsheets = self.env["documents.document"].with_user(user).get_spreadsheets_to_display()
        self.assertEqual([s['id'] for s in spreadsheets], [visible_doc.id], "filtering issue")

        with self.assertRaises(AccessError, msg="record rule should have raised"):
            manager_doc.with_user(user).raw = '{}'

    def test_spreadsheet_to_display_access_field_groups(self):
        existing_groups = self.env['documents.document']._fields['name'].groups
        self.env['documents.document']._fields['name'].groups = "base.group_system"
        user = new_test_user(self.env, "Test user", groups='documents.group_documents_manager')

        with self.assertRaises(AccessError, msg="field should be protected"):
            self.env["documents.document"].with_user(user).get_spreadsheets_to_display()
        self.env['documents.document']._fields['name'].groups = existing_groups

    def test_save_template(self):
        context = {
            "default_spreadshee_name": "Spreadsheet test",
            "default_template_name": "Spreadsheet test - Template",
            "default_data": TEXT,
            "default_thumbnail": GIF,
        }
        wizard = Form(self.env["save.spreadsheet.template"].with_context(context)).save()
        wizard.save_template()
        template = self.env["spreadsheet.template"].search([["name", "=", "Spreadsheet test - Template"]])
        self.assertTrue(template, "It should have created a template")
        self.assertEqual(template.name, "Spreadsheet test - Template")
        self.assertEqual(template.data, TEXT)
        self.assertEqual(template.thumbnail, GIF)
        # TODO test notif

    def test_user_right_own_template(self):
        user = new_test_user(self.env, "Test user", groups='documents.group_documents_user')
        template = self.env["spreadsheet.template"].with_user(user).create({
            "name": "hello",
            "data": TEXT,
        })
        template.write({
            "name": "bye",
        })
        template.unlink()

    def test_user_right_not_own_template(self):
        manager = new_test_user(self.env, "Test manager", groups='documents.group_documents_manager')
        user = new_test_user(self.env, "Test user", groups='documents.group_documents_user')
        template = self.env["spreadsheet.template"].with_user(manager).create({
            "name": "hello",
            "data": TEXT,
        })
        with self.assertRaises(AccessError, msg="cannot write on template of your friend"):
            template.with_user(user).write({
                "name": "bye",
            })
        with self.assertRaises(AccessError, msg="cannot delete template of your friend"):
            template.with_user(user).unlink()
        template.name = "bye"
        template.unlink()

    def test_contributor_write_raw(self):
        document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        user = new_test_user(self.env, "Test Manager", groups='documents.group_documents_manager')
        document.with_user(user).write({
            "raw": r"{}"
        })
        contributor = self.env["spreadsheet.contributor"].search([("user_id", "=", user.id), ("document_id", "=", document.id)])
        self.assertEqual(len(contributor), 1, "The contribution should be registered")

    def test_contributor_move_workspace(self):
        document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        new_folder = self.env["documents.folder"].create({"name": "New folder"})
        user = new_test_user(self.env, "Test Manager", groups='documents.group_documents_manager')
        document.with_user(user).write({
            "folder_id": new_folder.id
        })
        contributor = self.env["spreadsheet.contributor"].search([("user_id", "=", user.id), ("document_id", "=", document.id)])
        self.assertEqual(len(contributor), 0, "The contribution should not be registered")
        
    def test_document_replacement_with_handler(self):  
        document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        vals = {
            "name": "file",
            "folder_id": self.folder.id,
            "raw": r"{}",
            "handler": "spreadsheet"
        }
        document.write(vals)
        self.assertEqual(document.handler, "spreadsheet", "The handler must contain the value of the handler mentioned in vals")

    def test_document_replacement_with_mimetype(self):

        document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        vals = {
            "name": "test.txt",
            "datas": b'aGVsbG8hCg==\n',
            "folder_id": self.folder.id,
            "mimetype": "text/plain",
        }
        document.write(vals)
        self.assertEqual(document.handler, False, "The handler should have been reset")

    def test_document_replacement_with_mimetype_and_handler(self):
        document = self.env["documents.document"].create({
            "raw": r"{}",
            "folder_id": self.folder.id,
            "handler": "spreadsheet",
            "mimetype": "application/o-spreadsheet",
        })
        vals = {
            "name": "spreadsheet_file",
            "folder_id": self.folder.id,
            "raw": r"{}",
            "mimetype": "application/octet-stream",
            "handler": "spreadsheet"
        }
        document.write(vals)
        self.assertEqual(document.handler, "spreadsheet", "the handler must contain the value of the handler mentioned in vals")
