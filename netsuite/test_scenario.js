const fs = require('fs');
const path = require('path');

// 1. Setup the NetSuite mocks
const MOCK_DB = {
    reservations: [],
    customers: [{ internalid: "CUST-100", phone: "99123456" }],
    items: [{ internalid: "ITEM-999", itemid: "UNIT-305" }]
};

let reservationCounter = 5000;

global.define = function(deps, callback) {
    const mocks = {
        'N/record': {
            Type: { CUSTOMER: "customer", CUSTOMER_DEPOSIT: "customerdeposit" },
            create: (opts) => {
                const rec = {
                    type: opts.type,
                    fields: {},
                    sublists: {},
                    setValue: (f) => rec.fields[f.fieldId] = f.value,
                    selectNewLine: () => {},
                    setCurrentSublistValue: () => {},
                    commitLine: () => {},
                    save: () => {
                        const id = String(++reservationCounter);
                        rec.id = id;
                        if (opts.type === 'customsale_ns_reservations') {
                            MOCK_DB.reservations.push(rec);
                        }
                        return id;
                    }
                };
                return rec;
            },
            submitFields: (opts) => {
                console.log("\n[N/record Mock] submitFields called!");
                console.log("  Target Record ID:", opts.id);
                console.log("  Values to update:", JSON.stringify(opts.values, null, 2));
                return opts.id;
            }
        },
        'N/search': {
            Type: { ITEM: "item", CUSTOMER: "customer" },
            create: (opts) => ({
                run: () => ({
                    each: (cb) => {
                        if (opts.type === 'item') {
                            cb({ getValue: (f) => f.name === 'internalid' ? 'ITEM-999' : 'UNIT-305' });
                        }
                        return false; // Stop iteration
                    }
                })
            }),
            lookupFields: (opts) => {
                if (opts.type === 'customsale_ns_reservations') {
                    // Simulate returning the customer ID for this reservation
                    return { entity: [{ value: 'CUST-100' }] };
                }
                return {};
            }
        },
        'N/runtime': {
            getCurrentScript: () => ({
                getParameter: () => "mock_m2m_token_123"
            })
        },
        'N/format': { Type: { DATE: "date" }, format: () => "2026-07-29" },
        'N/log': {
            audit: (title, msg) => console.log(`[NS Audit Log] ${title} | ${msg}`),
            error: (title, msg) => console.error(`[NS Error Log] ${title} | ${msg}`),
            debug: () => {}
        }
    };
    
    const args = deps.map(d => mocks[d] || {});
    // Capture the exported object globally so we can call it
    global.exportedSuitelet = callback.apply(null, args);
};

// 2. Helper to run a Suitelet and capture response
function runSuitelet(filePath, method, payload, headers = {}) {
    const code = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
    eval(code); // This triggers global.define and populates global.exportedSuitelet
    
    const suitelet = global.exportedSuitelet;
    let responseBody = "";
    
    const request = {
        method: method,
        body: JSON.stringify(payload),
        headers: headers,
        parameters: {}
    };
    
    const response = {
        setHeader: () => {},
        write: (data) => { responseBody += data; }
    };
    
    suitelet.onRequest({ request, response });
    return JSON.parse(responseBody);
}

// 3. Scenario Execution
console.log("==================================================");
console.log("🎬 SCENARIO 1: CREATE RESERVATION VIA CHATBOT");
console.log("==================================================");

const reservationPayload = {
    action: "create_reservation",
    netsuiteBuildingId: "LOC-10",
    unitType: "STUDIO",
    checkIn: "2026-08-01",
    checkOut: "2026-08-05",
    customerName: "John Doe",
    customerPhone: "+968 99123456",
    totalAmount: 150,
    conversationId: "conv_abc123"
};

console.log("Sending POST to sl_chatbot.js with payload:");
console.log(JSON.stringify(reservationPayload, null, 2));

// We simulate authorized call by passing token in headers
const resResult = runSuitelet('sl_chatbot.js', 'POST', reservationPayload, { authorization: "Bearer mock_m2m_token_123" });

console.log("\nResponse from sl_chatbot.js:");
console.log(JSON.stringify(resResult, null, 2));

const createdResId = resResult.reservationId;

console.log("\n==================================================");
console.log("🎬 SCENARIO 2: SMARTPAY PAYMENT SYNC WEBHOOK");
console.log("==================================================");

const paymentPayload = {
    netsuiteReservationId: createdResId,
    amount: 75,
    smartpayOrderId: "SP-9988776655",
    paymentLinkId: "PAY-112233"
};

console.log("Customer paid! Sending POST to sl_payment_sync.js with payload:");
console.log(JSON.stringify(paymentPayload, null, 2));

const syncResult = runSuitelet('sl_payment_sync.js', 'POST', paymentPayload, { authorization: "Bearer mock_m2m_token_123" });

console.log("\nResponse from sl_payment_sync.js:");
console.log(JSON.stringify(syncResult, null, 2));

console.log("\n✅ Demo complete!");
