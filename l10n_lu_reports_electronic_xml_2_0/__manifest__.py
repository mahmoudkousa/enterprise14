# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Luxembourg - Accounting Reports XML 2.0',
    'icon': '/l10n_lu/static/description/icon.png',
    'version': '1.0',
    'description': """
ECDF-compliant XML accounting reports for Luxembourg
Allows export of electronic reports in Luxembourg's XML 2.0 format, according to the ecdf rules.
Odoo's interface has been validated by ecdf using this module.
Reporting by an accounting firm ("agent") is supported for all reports.

Available reports:

1) Annual accounts:
    * Profit and Loss (full or abridged)
    * Balance Sheet (full or abriged)
    * Chart of Accounts (comprising its Annex, specifying the details of the account 106)

    These 3 declarations are grouped together, as per eCDF format (but it is also possible to only generated the CoA report).
    All the account information is filled in automatically, other information is to be entered manually
    (Size of the undertaking, full/abriged version, number of employees).
    The user can additionally add comments, and export as "references" the notes added on the report.

2) VAT declarations:
    * Monthly/quarterly: Automatically filled in.
    * Annual (normal or simplified)

     Needs a small manual retreatment by an accountant to reclassify categories of the monthly/quarterly declarations that have to be further defined.
     An object "Yearly Tax Report Data" allows the user to insert this and other additional information.
     The declaration comprises the 2 appendices (every expenditure is seen as a "business expenditure")
     The flat-rate scheme for farmers and purchases/sales of manufactured tobacco are NOT supported.

3) Recapitulative statements of Intracommunity sales of goods and services (VAT Intra):
    Declarations on monthly/quarterly basis, filling in:
        * Recapitulative statement of Intracommunity supplies of goods:
            - Statement of IC supplies of goods
            - Statement of supplies of goods made in the context of triangular operations
            - Statement of corrections of the above information for previous declarations

            The statement of supplies of goods sent or transported under call off stocks arrangements (and their corrections) is NOT supported.
        * Recapitulative statement of Intracommunity supplies of services:
            - Statement of IC supplies of services
            - Statement of corrections for previous declarations

    These 2 declarations can be generated either independently of one another or grouped together (recommended).
    To draw the corrective tables, the user has the possibility to save the generated reports when exporting them.
    When generating a report, the user can then select old "saved" declarations. The system will compare them to 
    the actual data and, in the case of a mismatch, add the corrections to the current declaration.

4) Declaration appendices:
    * Table of acquisitions / amortisable expenditures:
        - Acquisitions of depreciable/amortisable capital expenditures:
            Filled in based on the recorded assets.
            Odoo currently doesn't support the entering of received subsidies. Hence,
            an amount of subsidies received equal to 0 will always be reported.
        - Depreciation/amortisation Table:
            Filled in based on the depreciation computed on the recorded assets.
            Everything is considered as "Business portion".

    """,
    'category': 'Accounting/Localizations/Reporting',
    'depends': ['l10n_lu_reports_electronic', 'account_asset'],
    'data': [
            'data/ir_cron_data.xml',
            'views/l10n_lu_electronic_report_2_0_template.xml',
            'views/res_company_views.xml',
            'views/l10n_lu_stored_intra_report_views.xml',
            'views/l10n_lu_yearly_tax_report_manual_views.xml',
            'wizard/l10n_lu_generate_xml.xml',
            'wizard/l10n_lu_generate_accounts_report.xml',
            'wizard/l10n_lu_generate_tax_report.xml',
            'wizard/l10n_lu_generate_vat_intra_report.xml',
            'security/ir.model.access.csv',
    ],
    'demo': ['data/demo_company.xml'],
    'license': 'OEEL-1',
    'auto_install': True,
    'installable': True
}
