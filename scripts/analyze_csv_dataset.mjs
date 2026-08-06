import fs from "fs";
import path from "path";

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(row);
  }
  return rows;
}

function parseAmount(val) {
  if (!val) return 0;
  const clean = val.replace(/OMR/gi, '').replace(/,/g, '').replace(/\"/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

const csvPath = path.resolve("./Chatbot Reservations Dataset.csv");
const rows = parseCSV(csvPath);
console.log(`Loaded ${rows.length} total rows from Chatbot Reservations Dataset.csv`);

// Let's inspect rows with non-empty Conversation ID, Payment Link Status, or Memo indicating Chatbot
const chatbotRows = rows.filter(r => {
  const convId = r["Conversation ID"] || r["Conversation ID "] || "";
  const paymentStatus = r["Payment Link Status"] || "";
  const memo = r["Memo"] || "";
  return convId.length > 0 || paymentStatus.length > 0 || memo.toLowerCase().includes("chatbot") || memo.toLowerCase().includes("ai assistant");
});

console.log(`Rows with Chatbot/Payment info directly in CSV: ${chatbotRows.length}`);

let totalChatbotFullAmount = 0;
let paidCount = 0;
let totalPaidAdvance = 0;

chatbotRows.forEach((r, idx) => {
  const fullAmount = parseAmount(r["Total Amount (Transaction Currency)"]);
  const paymentStatus = r["Payment Link Status"] || "";
  const isPaid = paymentStatus.toUpperCase().includes("PAID");
  
  totalChatbotFullAmount += fullAmount;
  if (isPaid) {
    paidCount++;
    const advMatch = paymentStatus.match(/([0-9.]+)\s*OMR/i);
    const adv = advMatch ? parseFloat(advMatch[1]) : (fullAmount * 0.5);
    totalPaidAdvance += adv;
  }

  console.log(`[${idx + 1}] Doc: ${r["Document Number/ID"]} | Entity: ${r["Entity"]} | Status: ${r["Status"]}`);
  console.log(`    Total Amount: ${fullAmount.toFixed(3)} OMR | Payment Status: ${paymentStatus} | ConvID: ${r["Conversation ID"] || r["Conversation ID "]}`);
});

console.log("\n=================================================");
console.log(`Chatbot Flagged Reservations in CSV: ${chatbotRows.length}`);
console.log(`Paid Reservations among them: ${paidCount}`);
console.log(`Total Full Reservation Value: ${totalChatbotFullAmount.toFixed(3)} OMR`);
console.log(`Total Advance Paid: ${totalPaidAdvance.toFixed(3)} OMR`);
console.log("=================================================");
