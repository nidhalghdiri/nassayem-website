# Nassayem — NetSuite Payment Link Scripts

Three SuiteScript 2.1 files implementing the NetSuite-side of the off-website payment-link flow.

## Files

| File | Type | Purpose |
| --- | --- | --- |
| `ue_payment_link.js` | User Event Script | Adds the "Online Payment" button to the reservation form |
| `cs_payment_link.js` | Client Script | Handles the button click — modal for amount, calls Suitelet, shows result with Copy / WhatsApp |
| `sl_payment_link.js` | Suitelet | Server-side proxy. Reads the reservation, signs the request with the shared secret, calls our website API |

## Why three scripts and not two

The `x-netsuite-secret` header value cannot be in the Client Script — it would be visible in the browser's network tab. The Suitelet runs on NetSuite servers, reads the secret from a script parameter, and is the only component that ever sees the secret.

## Customisation before deploying

### 1. Field mapping in `sl_payment_link.js`

At the top of the Suitelet there's a `FIELD_IDS` object. Replace the right-hand strings with the actual field IDs on **your** reservation record:

```js
var FIELD_IDS = {
  reservationRef:  "tranid",                       // human-readable ref
  customerEntity:  "entity",                       // standard customer link
  customerNameTxt: "custbody_nass_customer_name",  // free-text fallback
  customerPhone:   "custbody_nass_customer_phone",
  customerEmail:   "custbody_nass_customer_email",
  checkIn:         "custbody_nass_check_in",
  checkOut:        "custbody_nass_check_out",
  unitCode:        "custbody_nass_unit_code",
  description:     "custbody_nass_payment_note",
};
```

Only `customerEntity` (or `customerNameTxt`) is strictly required — everything else is optional. The Suitelet falls back to the linked Customer record's `phone` / `email` / `companyname` when the reservation fields are blank.

### 2. Suitelet script & deployment IDs in `cs_payment_link.js`

Near the top of the Client Script:

```js
var SUITELET_SCRIPT_ID = "customscript_nass_sl_paylink";
var SUITELET_DEPLOY_ID = "customdeploy_nass_sl_paylink";
```

These must match the IDs you set when creating the Suitelet's Script record and Deployment record (see step 4 below).

## Deployment steps in NetSuite

### 1. Upload the three .js files to the File Cabinet

Documents → Files → File Cabinet → SuiteScripts → (create folder e.g. "Nassayem/PaymentLink")
Upload all three files there.

### 2. Create the Suitelet Script record

Customisation → Scripting → Scripts → New
- **Script File**: select `sl_payment_link.js`
- **Name**: `Nassayem — Create Payment Link`
- **ID**: `_nass_sl_paylink` (final id becomes `customscript_nass_sl_paylink`)
- **Description**: optional

Add **Script Parameters** (Parameters subtab):

| Field ID | Label | Type | Mandatory | Display |
| --- | --- | --- | --- | --- |
| `_nass_website_url` | Website Base URL | Free-form Text | Yes | Display |
| `_nass_inbound_secret` | Inbound Secret | Password | Yes | Display |

Save the script.

### 3. Deploy the Suitelet

On the script record click **Deploy Script**:
- **Title**: `Nassayem — Create Payment Link`
- **ID**: `_nass_sl_paylink` (final id becomes `customdeploy_nass_sl_paylink`)
- **Status**: Released
- **Available Without Login**: **NO** (very important — internal use only)
- **Audience**: choose the roles allowed to create payment links (Receptionist, Manager, Admin)

In the **Parameters** subtab on the deployment, set:
- **Website Base URL**: `https://nassayem.com` (or your Vercel preview URL during testing)
- **Inbound Secret**: paste the same value you set as `NETSUITE_INBOUND_SECRET` on Vercel

Save.

### 4. Create the Client Script record

Customisation → Scripting → Scripts → New
- **Script File**: `cs_payment_link.js`
- **Name**: `Nassayem — Payment Link Button (Client)`
- **ID**: `_nass_cs_paylink`

No script parameters needed.

### 5. Deploy the Client Script

On the script record click **Deploy Script**:
- **Applies To**: select your **Reservation** record type
- **Title**: `Nassayem — Payment Link (Client)`
- **ID**: `_nass_cs_paylink`
- **Status**: Released
- **Audience**: same roles as the Suitelet

### 6. Create the User Event Script record

Customisation → Scripting → Scripts → New
- **Script File**: `ue_payment_link.js`
- **Name**: `Nassayem — Payment Link Button (UE)`
- **ID**: `_nass_ue_paylink`

### 7. Deploy the User Event Script

On the script record click **Deploy Script**:
- **Applies To**: same Reservation record type
- **Title**: `Nassayem — Payment Link (UE)`
- **ID**: `_nass_ue_paylink`
- **Status**: Released
- **Event Type**: leave default (script triggers `beforeLoad`)
- **Audience**: same roles

## Testing

1. Open any saved Reservation record in **View** mode.
2. The **Online Payment** button should appear in the top-right button row.
3. Click it. Enter an amount (e.g. `40`).
4. Optionally enter a short note, or just click OK to skip.
5. After ~1 second a dialog appears with the payment URL — already copied to clipboard.
6. If the customer's phone is on the reservation, a **Send WhatsApp** button is offered.
7. Open the URL in a private browser tab to see the customer-facing page on the website.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Button doesn't appear | UE script not deployed to the correct record type, or status is not Released |
| Click does nothing | Client Script not deployed on the same record type, or function name mismatch (must be `showPaymentLinkDialog`) |
| "Server misconfigured (script parameters missing)" | Open the Suitelet **Deployment** record and set the two parameter values |
| 401 Unauthorized from Suitelet logs | The Inbound Secret on the deployment doesn't match `NETSUITE_INBOUND_SECRET` on Vercel |
| "Could not resolve customer name" | Set the customer link, or fill the `custbody_nass_customer_name` field. Update `FIELD_IDS` in the Suitelet to match your schema |
| Dates come through as null on the public page | Either the field IDs in `FIELD_IDS` are wrong, or those date fields are empty on the reservation |

Server-side errors are logged. Customisation → Scripting → Script Execution Logs → filter by the Suitelet script record.

## Outbound callback on payment success (next step)

When a customer pays, the website POSTs a payment-confirmation payload back to NetSuite at the URL set as `NETSUITE_OUTBOUND_URL` (Vercel env), with `Authorization: Bearer <NETSUITE_M2M_TOKEN>`.

You'll need a fourth NetSuite component to receive that callback — a **RESTlet** or another **Suitelet** (with M2M / OAuth 2.0 auth). It should:
1. Look up the reservation by `netsuiteReservationId`.
2. Record the payment (e.g. create a Customer Payment, or update a custom payment-status field).
3. Return 200 OK.

The website logs sync errors on each `NetsuitePayment` row and shows them in `/admin/netsuite-payments`, so you can re-sync manually if NetSuite is down.

---

## Chatbot Suitelet (`sl_chatbot.js`)

Gives the AI chatbot real-time availability from NetSuite and lets it create reservations automatically (payment is collected via the existing payment-link flow).

The availability logic mirrors `reservation_script.js` (the reservation form's client script) exactly: units = service items filtered by `location` + `custitem_ns_item_unit_type`; busy = `customsale_ns_reservations` overlapping the dates (account 1388) whose status code ends in **A** (Pending Check-In) or **B** (Checked-In). Reservation creation replicates `onAddUnits()`: find-or-create the customer by phone (subsidiary 2), then a reservation with `startdate`/`enddate`, `location`, cycle/period, and one item line (UOM 86 day / 87 month, custom rate from the website's quoted total).

**Deploy:**
1. Upload `sl_chatbot.js` as a Suitelet, **Available Without Login: YES**.
2. Define script parameter `custscript_nass_chatbot_token` — a long random string. Put the SAME value in the website env var `NETSUITE_M2M_TOKEN`.
3. Verify the `CONFIG` block: `UNIT_TYPE_MAP` internal ids (currently Studio=3, 1BHK=2, 2BHK=1, 3BHK=4, Villa=5), the reservation `accountId` (1388) and customer `subsidiary` (2).
4. Copy the deployment's **external URL** into the website env var `NETSUITE_CHATBOT_RESTLET_URL` and redeploy the website.

Until `NETSUITE_CHATBOT_RESTLET_URL` is set, the chatbot silently falls back to website-side availability, so deploys are safe in any order.

**Test with curl:**
```bash
curl -X POST "$SUITELET_EXTERNAL_URL" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"check_availability","unitType":"TWO_BEDROOM","netsuiteBuildingId":"77","checkIn":"2026-08-10","checkOut":"2026-08-13"}'
```
