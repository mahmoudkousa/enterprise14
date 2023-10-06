# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64

from odoo.exceptions import AccessError
from odoo.tests import SavepointCase


class testAttachmentAccess(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = cls.env['res.users'].create({
            'name': "foo",
            'login': "foo",
            'email': "foo@bar.com",
            'groups_id': [(6, 0, [cls.env.ref('sign.group_sign_user').id])]
        })

    def test_user_template_attachment_without_res_fields(self):
        """Test an employee can create a template linked to an attachment without res_model/res_id"""
        env_user = self.env(user=self.user)
        # As user, create an attachment without res_model/res_id
        attachment = env_user['ir.attachment'].create({'name': 'foo', 'datas': base64.b64encode(b'foo')})
        # As user, create a sign.template linked to that attachment
        template = env_user['sign.template'].create({'attachment_id': attachment.id})
        # As user, ensure the content of the attachment can be read through the template
        self.assertEqual(base64.b64decode(template.datas), b'foo')
        # As user, create another attachment without res_model/res_id
        attachment_2 = env_user['ir.attachment'].create({'name': 'foo', 'datas': base64.b64encode(b'bar')})
        # As user, change the attachment of the template to this second attachment
        template.write({'attachment_id': attachment_2.id})
        # As user, ensure the content of this second attachment can be read through the template
        self.assertEqual(base64.b64decode(template.datas), b'bar')

    def test_user_template_attachment_without_res_fields_created_by_admin(self):
        """Test an employee can read the content of the template's attachment created by another user, the admin,
        and the attachment does not have a res_model/res_id
        """
        # As admin, create an attachment without res_model/res_id
        attachment = self.env['ir.attachment'].create({'name': 'foo', 'datas': base64.b64encode(b'foo')})
        # As admin, create a sign.template linked to that attachment
        template = self.env['sign.template'].create({'attachment_id': attachment.id})

        # As user, ensure the attachment itself cannot be read
        attachment.invalidate_cache()
        with self.assertRaises(AccessError):
            attachment.with_user(self.user).datas
        # But, as user, the content of the attachment can be read through the template
        self.assertEqual(base64.b64decode(template.with_user(self.user).datas), b'foo')

        # As admin, create a second attachment without res_model/res_id
        attachment = self.env['ir.attachment'].create({'name': 'bar', 'datas': base64.b64encode(b'bar')})
        # As admin, link this second attachment to the previously created template (write instead of create)
        template.write({'attachment_id': attachment.id})

        # As user ensure the attachment itself cannot be read
        attachment.invalidate_cache()
        with self.assertRaises(AccessError):
            self.assertEqual(base64.b64decode(attachment.with_user(self.user).datas), b'bar')
        # But, as user, the content of the attachment can be read through the template
        self.assertEqual(base64.b64decode(template.with_user(self.user).datas), b'bar')

    def test_user_read_unallowed_attachment(self):
        """Test a user cannot access an attachment he is not supposed to through a sign template"""
        # As admin, create an attachment for which you require the settings group to access
        base_module = self.env.ref('base.module_base')
        attachment_forbidden = self.env['ir.attachment'].create({
            'name': 'foo', 'datas': base64.b64encode(b'foo'),
            'res_model': base_module._name, 'res_id': base_module.id,
        })
        # As user, make sure this is indeed not possible to access that attachment data directly
        attachment_forbidden.invalidate_cache()
        with self.assertRaises(AccessError):
            attachment_forbidden.with_user(self.user).datas
        # As user, create a template pointing to that attachment
        # and make sure it raises an access error
        with self.assertRaises(AccessError):
            template = self.env['sign.template'].with_user(self.user).create({
                'attachment_id': attachment_forbidden.id,
            })
            template.datas

        # As user, update the attachment of an existing template to the unallowed attachment
        # and make sure it raises an access error
        attachment_tmp = self.env['ir.attachment'].with_user(self.user).create({
            'name': 'bar', 'datas': base64.b64encode(b'bar'),
        })
        template = self.env['sign.template'].with_user(self.user).create({
            'attachment_id': attachment_tmp.id,
        })
        with self.assertRaises(AccessError):
            template.write({'attachment_id': attachment_forbidden.id})
            template.datas
