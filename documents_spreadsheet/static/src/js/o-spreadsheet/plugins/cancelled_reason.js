odoo.define("documents_spreadsheet.CancelledReason", function (require) {
  "use strict";
  return {
    FilterNotFound: 1000,
    DuplicatedFilterLabel: 1001,
    InvalidValueTypeCombination: 1002,
  };
});
