import fs from "fs";

const metrics = JSON.parse(fs.readFileSync("chatbot_executive_metrics.json", "utf-8"));
const { executiveSummary, businessImpactAndROI, channelBreakdown, languageBreakdown } = metrics;

const csvRows = [
  ["Metric", "Value (USD)", "Value (OMR)", "Notes"],
  ["Total AI API Spend", `$${executiveSummary.totalSpendUSD}`, `${executiveSummary.totalSpendOMR} OMR`, "All-time token usage cost"],
  ["Total Conversations", executiveSummary.totalConversations, executiveSummary.totalConversations, "5900 WhatsApp, 60 Web"],
  ["Total Messages Processed", executiveSummary.totalMessages, executiveSummary.totalMessages, "Customer + Bot + Tool queries"],
  ["Qualified Booking Leads Captured", executiveSummary.totalLeads, executiveSummary.totalLeads, "Customers with dates & contact info"],
  ["Average Cost per Conversation", `$${executiveSummary.avgCostPerConversationUSD}`, `${executiveSummary.avgCostPerConversationOMR} OMR`, "~10 Baizas per customer"],
  ["Average Messages per Conversation", executiveSummary.avgMessagesPerConversation, executiveSummary.avgMessagesPerConversation, "17.6 messages per interaction"],
  ["Average Cost per Message", `$${executiveSummary.avgCostPerMessageUSD}`, `${executiveSummary.avgCostPerMessageOMR} OMR`, "~0.5 Baiza per message"],
  ["Average Cost per Qualified Lead", `$${executiveSummary.avgCostPerLeadUSD}`, `${executiveSummary.avgCostPerLeadOMR} OMR`, "130 Baizas per lead"],
  ["Estimated Human Labor Cost Equivalent", `$${businessImpactAndROI.estimatedHumanLaborCostUSD}`, `${businessImpactAndROI.estimatedHumanLaborCostOMR} OMR`, "Based on 3.5 OMR/hr agent rate"],
  ["Net Financial Savings", `$${businessImpactAndROI.netSavingsUSD}`, `${businessImpactAndROI.netSavingsOMR} OMR`, "Direct savings vs human staff"],
  ["Return on Investment (ROI)", businessImpactAndROI.roiPercentage, businessImpactAndROI.roiPercentage, "44.1x return on spend"],
];

const csvContent = csvRows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
fs.writeFileSync("chatbot_kpis_summary.csv", csvContent);
console.log("CSV KPI summary generated at chatbot_kpis_summary.csv");
