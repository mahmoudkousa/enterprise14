from odoo import models, api, fields, _
from odoo.exceptions import UserError
import calendar
import re


class AccountTaxReportActivity(models.Model):
    _inherit = "mail.activity"

    def _get_vat_report_action_to_open(self, company_id):
        if company_id.country_id.code == 'BE':
            return self.env["ir.actions.actions"]._for_xml_id("l10n_be_reports.action_account_report_be_vat")
        else:
            return super(AccountTaxReportActivity, self)._get_vat_report_action_to_open(company_id)


class AccountGenericTaxReport(models.AbstractModel):
    _inherit = 'account.generic.tax.report'

    def _get_reports_buttons(self):
        buttons = super(AccountGenericTaxReport, self)._get_reports_buttons()
        if self.env.company.country_id.code == 'BE':
            buttons += [{'name': _('Export (XML)'), 'sequence': 3, 'action': 'l10n_be_print_xml', 'file_export_type': _('XML')}]
        return buttons

    def l10n_be_print_xml(self, options):
        # add options to context and return action to open transient model
        ctx = self.env.context.copy()
        ctx['l10n_be_reports_generation_options'] = options
        new_wizard = self.env['l10n_be_reports.periodic.vat.xml.export'].create({})
        view_id = self.env.ref('l10n_be_reports.view_account_financial_report_export').id
        return {
            'name': _('XML Export Options'),
            'view_mode': 'form',
            'views': [[view_id, 'form']],
            'res_model': 'l10n_be_reports.periodic.vat.xml.export',
            'type': 'ir.actions.act_window',
            'res_id': new_wizard.id,
            'target': 'new',
            'context': ctx,
            }

    def get_xml(self, options):
        # Check
        if self.env.company.country_id.code != 'BE':
            return super(AccountGenericTaxReport, self).get_xml(options)
        company = self.env.company
        if not company.partner_id.vat:
            raise UserError(_('No VAT number associated with your company.'))
        vat_no, country_from_vat = self._check_vat_number(company.partner_id.vat)

        default_address = company.partner_id.address_get()
        address = self.env['res.partner'].browse(default_address.get("default")) or company.partner_id
        if not address.email:
            raise UserError(_('No email address associated with the company.'))
        if not address.phone:
            raise UserError(_('No phone associated with the company.'))

        # Compute xml

        default_address = company.partner_id.address_get()
        address = self.env['res.partner'].browse(default_address.get("default", company.partner_id.id))

        issued_by = vat_no
        dt_from = options['date'].get('date_from')
        dt_to = options['date'].get('date_to')
        send_ref = str(company.partner_id.id) + str(dt_from[5:7]) + str(dt_to[:4])
        starting_month = dt_from[5:7]
        ending_month = dt_to[5:7]
        quarter = str(((int(starting_month) - 1) // 3) + 1)

        date_from = dt_from[0:7] + '-01'
        date_to = dt_to[0:7] + '-' + str(calendar.monthrange(int(dt_to[0:4]), int(ending_month))[1])

        data = {'client_nihil': options.get('client_nihil'), 'ask_restitution': options.get('ask_restitution', False), 'ask_payment': options.get('ask_payment', False)}

        complete_vat = (country_from_vat or (address.country_id and address.country_id.code or "")) + vat_no
        file_data = {
                        'issued_by': issued_by,
                        'vat_no': complete_vat,
                        'only_vat': vat_no,
                        # Company name can contain only latin characters
                        'cmpny_name': re.sub('[^-A-Za-z0-9/?:().,\'+ ]', ' ', company.name),
                        'address': "%s %s" % (address.street or "", address.street2 or ""),
                        'post_code': address.zip or "",
                        'city': address.city or "",
                        'country_code': address.country_id and address.country_id.code or "",
                        'email': address.email or "",
                        'phone': self._raw_phonenumber(address.phone),
                        'send_ref': send_ref,
                        'quarter': quarter,
                        'month': starting_month,
                        'year': str(dt_to[:4]),
                        'client_nihil': (data['client_nihil'] and 'YES' or 'NO'),
                        'ask_restitution': (data['ask_restitution'] and 'YES' or 'NO'),
                        'ask_payment': (data['ask_payment'] and 'YES' or 'NO'),
                        'comments': self._get_report_manager(options).summary or '',
                     }

        rslt = """<?xml version="1.0"?>
<ns2:VATConsignment xmlns="http://www.minfin.fgov.be/InputCommon" xmlns:ns2="http://www.minfin.fgov.be/VATConsignment" VATDeclarationsNbr="1">
""" + self._get_belgian_xml_export_representative_node() + """
    <ns2:VATDeclaration SequenceNumber="1" DeclarantReference="%(send_ref)s">
        <ns2:Declarant>
            <VATNumber xmlns="http://www.minfin.fgov.be/InputCommon">%(only_vat)s</VATNumber>
            <Name>%(cmpny_name)s</Name>
            <Street>%(address)s</Street>
            <PostCode>%(post_code)s</PostCode>
            <City>%(city)s</City>
            <CountryCode>%(country_code)s</CountryCode>
            <EmailAddress>%(email)s</EmailAddress>
            <Phone>%(phone)s</Phone>
        </ns2:Declarant>
        <ns2:Period>
    """ % (file_data)

        if starting_month != ending_month:
            # starting month and ending month of selected period are not the same
            # it means that the accounting isn't based on periods of 1 month but on quarters
            rslt += '\t\t<ns2:Quarter>%(quarter)s</ns2:Quarter>\n\t\t' % (file_data)
        else:
            rslt += '\t\t<ns2:Month>%(month)s</ns2:Month>\n\t\t' % (file_data)
        rslt += '\t<ns2:Year>%(year)s</ns2:Year>' % (file_data)
        rslt += '\n\t\t</ns2:Period>\n'
        rslt += '\t\t<ns2:Data>\t'

        grids_list = []
        currency_id = self.env.company.currency_id

        ctx = self._set_context(options)
        ctx.update({'no_format': True, 'date_from': date_from, 'date_to': date_to})
        lines = self.with_context(ctx)._get_lines(options)

        # Create a mapping between report line ids and actual grid names
        non_compound_rep_lines = self.env['account.tax.report.line'].search([('tag_name', 'not in', ('48s44', '48s46L', '48s46T', '46L', '46T')), ('report_id.country_id.code', '=', 'BE')])
        lines_grids_map = {line.id: line.tag_name for line in non_compound_rep_lines}
        lines_grids_map['section_' + str(self.env.ref('l10n_be.tax_report_title_operations_sortie_46').id)] = '46'
        lines_grids_map['section_' + str(self.env.ref('l10n_be.tax_report_title_operations_sortie_48').id)] = '48'
        lines_grids_map['total_' + str(self.env.ref('l10n_be.tax_report_line_71').id)] = '71'
        lines_grids_map['total_' + str(self.env.ref('l10n_be.tax_report_line_72').id)] = '72'

        # Iterate on the report lines, using this mapping
        for line in lines:
            if line['id'] in lines_grids_map and not currency_id.is_zero(line['columns'][0]['name']):
                grids_list.append((lines_grids_map[line['id']], line['columns'][0]['name']))

        if options.get('grid91') and not currency_id.is_zero(options['grid91']):
            grids_list.append(('91', options['grid91']))

        # We are ignoring all grids that have 0 as values, but the belgian government always require a value at
        # least in either the grid 71 or 72. So in the case where both are set to 0, we are adding the grid 71 in the
        # xml with 0 as a value.
        if len([item for item in grids_list if item[0] == '71' or item[0] == '72']) == 0:
            grids_list.append(('71', 0))

        grids_list = sorted(grids_list, key=lambda a: a[0])
        for item in grids_list:
            grid_amount_data = {
                    'code': item[0],
                    'amount': '%.2f' % abs(item[1]),
                    }
            rslt += '\n\t\t\t<ns2:Amount GridNumber="%(code)s">%(amount)s</ns2:Amount''>' % (grid_amount_data)

        rslt += '\n\t\t</ns2:Data>'
        rslt += '\n\t\t<ns2:ClientListingNihil>%(client_nihil)s</ns2:ClientListingNihil>' % (file_data)
        rslt += '\n\t\t<ns2:Ask Restitution="%(ask_restitution)s" Payment="%(ask_payment)s"/>' % (file_data)
        rslt += '\n\t\t<ns2:Comment>%(comments)s</ns2:Comment>' % (file_data)
        rslt += '\n\t</ns2:VATDeclaration> \n</ns2:VATConsignment>'

        return rslt.encode()

    def _check_vat_number(self, vat_number):
        """
        Even with base_vat, the vat number doesn't necessarily starts
        with the country code
        We should make sure the vat is set with the country code
        to avoid submitting this declaration with a wrong vat number
        """
        vat_number = vat_number.replace(' ', '').upper()
        try:
            int(vat_number[:2])
            country_code = None
        except ValueError:
            country_code = vat_number[:2]
            vat_number = vat_number[2:]

        return vat_number, country_code
