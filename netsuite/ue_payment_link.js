/**
 * Nassayem — User Event Script that adds the "Online Payment" button to the
 * reservation form.
 *
 * The button calls `showPaymentLinkDialog` from the Client Script
 * (cs_payment_link.js) which must also be deployed on the same record type.
 *
 * Deployment notes:
 *   - Script type: User Event Script
 *   - Deploy on the same record type as the Client Script.
 *   - Trigger: beforeLoad
 *   - Recommended: deploy as "View" (and optionally "Edit") only.
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(["N/runtime"], function (runtime) {

  function beforeLoad(context) {
    // Only show the button when the receptionist is viewing the saved record.
    // Add EDIT here if you also want the button on the edit form.
    var allowedTypes = [
      context.UserEventType.VIEW,
      // context.UserEventType.EDIT,
    ];
    if (allowedTypes.indexOf(context.type) === -1) return;

    // Optional: hide button for roles that should not collect payment.
    // Uncomment + edit role ids to use:
    // var role = runtime.getCurrentUser().role;
    // var allowedRoles = [3 /* Administrator */, 1019 /* Receptionist */];
    // if (allowedRoles.indexOf(role) === -1) return;

    var form = context.form;
    form.addButton({
      id: "custpage_nass_payment_link",
      label: "Online Payment",
      functionName: "showPaymentLinkDialog",
    });
  }

  return { beforeLoad: beforeLoad };
});
