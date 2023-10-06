# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# TODO: [XBO] merge with helpdesk_sale_timesheet module in master
{
    'name': 'Helpdesk Sales Timesheet Edit',
    'category': 'Hidden',
    'summary': 'Edit the sale order line linked in the timesheets',
    'description': """
Allow to edit sale order line in the timesheets
===============================================

This module adds the edition of the sale order line
set in the timesheets. This allows adds more flexibility
to the user to easily change the sale order line on a
timesheet in ticket form view when it is needed.
""",
    'depends': ['helpdesk_sale_timesheet', 'sale_timesheet_edit'],
    'data': ['views/helpdesk_ticket.xml'],
    'demo': [],
    'auto_install': True,
    'license': 'OEEL-1',
}
