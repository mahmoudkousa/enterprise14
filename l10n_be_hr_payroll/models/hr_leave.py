from odoo import models, _


class HolidaysRequest(models.Model):
    _name = "hr.leave"
    _inherit = 'hr.leave'

    def action_validate(self):
        res = super(HolidaysRequest, self).action_validate()
        for leave in self:
            if leave.employee_id.company_id.country_id.code == "BE" and \
                    leave.holiday_status_id.work_entry_type_id in self._get_drs_work_entry_types():
                drs_link = "https://www.socialsecurity.be/site_fr/employer/applics/drs/index.htm"
                drs_link = '<a href="%s" target="_blank">%s</a>' % (drs_link, drs_link)
                leave.activity_schedule(
                    'mail.mail_activity_data_todo',
                    note=_('%s is in %s. Fill in the appropriate eDRS here: %s',
                           leave.employee_id.name,
                           leave.holiday_status_id.name,
                           drs_link),
                    user_id=leave.holiday_status_id.responsible_id.id or self.env.user.id,
                )
        return res

    def _get_drs_work_entry_types(self):
        drs_work_entry_types = [
            self.env.ref('l10n_be_hr_payroll.work_entry_type_breast_feeding'),
            self.env.ref('l10n_be_hr_payroll.work_entry_type_long_sick'),
            self.env.ref('l10n_be_hr_payroll.work_entry_type_maternity'),
            self.env.ref('l10n_be_hr_payroll.work_entry_type_paternity_legal'),
            self.env.ref('l10n_be_hr_payroll.work_entry_type_small_unemployment'),
            self.env.ref('l10n_be_hr_payroll.work_entry_type_unpredictable'),
            self.env.ref('l10n_be_hr_payroll.work_entry_type_youth_time_off'),
        ]
        # TODO LTU in master: add l10n_be_hr_payroll.work_entry_type_work_accident directly in the list
        work_entry_type_work_accident = self.env.ref('l10n_be_hr_payroll.work_entry_type_work_accident',
                                                     raise_if_not_found=False)
        if work_entry_type_work_accident:
            drs_work_entry_types.append(work_entry_type_work_accident)

        return drs_work_entry_types
