import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { format } from "date-fns";

// ── Brand colours ─────────────────────────────────────────────────────────────
const COLOR = {
  primary: "#2a7475",
  primaryLight: "#3b9293",
  primaryDark: "#1d5455",
  bg: "#f8fafa",
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray400: "#9ca3af",
  gray600: "#4b5563",
  gray700: "#374151",
  gray900: "#111827",
  amber: "#d97706",
  green: "#059669",
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    backgroundColor: COLOR.white,
    fontFamily: "Helvetica",
    paddingBottom: 40,
  },

  // Header
  header: {
    backgroundColor: COLOR.primary,
    paddingHorizontal: 40,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flexDirection: "column" },
  headerBrand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: COLOR.white, letterSpacing: 0.5 },
  headerTagline: { fontSize: 9, color: "#b2d8d8", marginTop: 3, letterSpacing: 0.3 },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  headerDoc: { fontSize: 9, color: "#b2d8d8", letterSpacing: 1, textTransform: "uppercase" },
  headerDate: { fontSize: 9, color: "#b2d8d8", marginTop: 3 },

  // Booking code banner
  codeBanner: {
    backgroundColor: COLOR.primaryDark,
    paddingHorizontal: 40,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeLabel: { fontSize: 9, color: "#b2d8d8", letterSpacing: 1, textTransform: "uppercase" },
  codeValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: COLOR.white, letterSpacing: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },

  // Body
  body: { paddingHorizontal: 40, paddingTop: 28 },

  // Section headings
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLOR.primary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  // Two-column row
  row2: { flexDirection: "row", gap: 16, marginBottom: 20 },
  card: {
    flex: 1,
    backgroundColor: COLOR.gray50,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: COLOR.gray100,
  },
  cardRow: { flexDirection: "row", marginBottom: 7 },
  cardLabel: { fontSize: 8, color: COLOR.gray400, width: 72 },
  cardValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLOR.gray900, flex: 1 },

  // Stay details strip
  stayStrip: {
    backgroundColor: COLOR.primary,
    borderRadius: 6,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  stayItem: { alignItems: "center", flex: 1 },
  stayLabel: { fontSize: 8, color: "#b2d8d8", letterSpacing: 0.5, marginBottom: 4 },
  stayValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: COLOR.white },
  stayDivider: { width: 1, backgroundColor: "#3b9293", marginHorizontal: 8 },

  // Payment block
  paymentCard: {
    backgroundColor: COLOR.gray50,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: COLOR.gray100,
    marginBottom: 20,
  },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  paymentLabel: { fontSize: 9, color: COLOR.gray600 },
  paymentValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLOR.gray900 },
  paymentDivider: { height: 1, backgroundColor: COLOR.gray100, marginVertical: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: COLOR.gray900 },
  totalValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: COLOR.primary },

  // Notes
  notesBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: 20,
  },
  notesLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLOR.amber, marginBottom: 4 },
  notesText: { fontSize: 9, color: COLOR.gray700, lineHeight: 1.5 },

  // Important notice
  noticeBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 20,
  },
  noticeText: { fontSize: 9, color: "#065f46", lineHeight: 1.5 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLOR.primary,
    paddingHorizontal: 40,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 8, color: "#b2d8d8" },
  footerBrand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLOR.white },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingPdfData = {
  bookingCode: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNationality: string | null;
  guestNotes: string | null;
  paymentMethod: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  totalNights: number;
  totalPrice: number;
  unitTitleEn: string;
  buildingNameEn: string;
  buildingAddress?: string | null;
  issuedAt: Date;
};

// ── Helper ────────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return format(d, "dd MMM yyyy");
}

function paymentLabel(method: string) {
  return method === "CASH" ? "Cash at Reception" : "Online (Card)";
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    PENDING: { label: "Pending Confirmation", bg: "#fef3c7", color: COLOR.amber },
    CONFIRMED: { label: "Confirmed", bg: "#d1fae5", color: COLOR.green },
    COMPLETED: { label: "Completed", bg: "#dbeafe", color: "#1d4ed8" },
    CANCELLED: { label: "Cancelled", bg: "#fee2e2", color: "#dc2626" },
  };
  return map[status] ?? { label: status, bg: COLOR.gray100, color: COLOR.gray600 };
}

// ── PDF Document ──────────────────────────────────────────────────────────────

function BookingConfirmationDocument({ data }: { data: BookingPdfData }) {
  const st = statusLabel(data.status);

  return (
    <Document
      title={`Booking Confirmation ${data.bookingCode}`}
      author="Nassayem Salalah"
      subject="Booking Confirmation"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerBrand}>Nassayem Salalah</Text>
            <Text style={s.headerTagline}>Premium Furnished Apartments · Dhofar, Oman</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDoc}>Booking Confirmation</Text>
            <Text style={s.headerDate}>Issued: {fmt(data.issuedAt)}</Text>
          </View>
        </View>

        {/* ── Booking code banner ── */}
        <View style={s.codeBanner}>
          <View>
            <Text style={s.codeLabel}>Booking Reference</Text>
            <Text style={s.codeValue}>{data.bookingCode}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={{ color: st.color }}>{st.label}</Text>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>

          {/* Guest & Property cards */}
          <View style={s.row2}>

            {/* Guest */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Guest Information</Text>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Name</Text>
                <Text style={s.cardValue}>{data.guestName}</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Email</Text>
                <Text style={s.cardValue}>{data.guestEmail}</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Phone</Text>
                <Text style={s.cardValue}>{data.guestPhone}</Text>
              </View>
              {data.guestNationality && (
                <View style={s.cardRow}>
                  <Text style={s.cardLabel}>Nationality</Text>
                  <Text style={s.cardValue}>{data.guestNationality}</Text>
                </View>
              )}
            </View>

            {/* Property */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Property Details</Text>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Unit</Text>
                <Text style={s.cardValue}>{data.unitTitleEn}</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Building</Text>
                <Text style={s.cardValue}>{data.buildingNameEn}</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Location</Text>
                <Text style={s.cardValue}>Salalah, Dhofar, Oman</Text>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>Contact</Text>
                <Text style={s.cardValue}>+968 99551237</Text>
              </View>
            </View>
          </View>

          {/* Stay details strip */}
          <Text style={s.sectionTitle}>Stay Details</Text>
          <View style={s.stayStrip}>
            <View style={s.stayItem}>
              <Text style={s.stayLabel}>CHECK-IN</Text>
              <Text style={s.stayValue}>{fmt(data.checkIn)}</Text>
            </View>
            <View style={s.stayDivider} />
            <View style={s.stayItem}>
              <Text style={s.stayLabel}>CHECK-OUT</Text>
              <Text style={s.stayValue}>{fmt(data.checkOut)}</Text>
            </View>
            <View style={s.stayDivider} />
            <View style={s.stayItem}>
              <Text style={s.stayLabel}>DURATION</Text>
              <Text style={s.stayValue}>{data.totalNights} {data.totalNights === 1 ? "Night" : "Nights"}</Text>
            </View>
          </View>

          {/* Payment */}
          <Text style={s.sectionTitle}>Payment Summary</Text>
          <View style={s.paymentCard}>
            <View style={s.paymentRow}>
              <Text style={s.paymentLabel}>Accommodation ({data.totalNights} nights)</Text>
              <Text style={s.paymentValue}>{data.totalPrice.toFixed(3)} OMR</Text>
            </View>
            <View style={s.paymentRow}>
              <Text style={s.paymentLabel}>Payment Method</Text>
              <Text style={s.paymentValue}>{paymentLabel(data.paymentMethod)}</Text>
            </View>
            <View style={s.paymentDivider} />
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Amount</Text>
              <Text style={s.totalValue}>{data.totalPrice.toFixed(3)} OMR</Text>
            </View>
          </View>

          {/* Guest notes */}
          {data.guestNotes && (
            <>
              <Text style={s.sectionTitle}>Special Requests</Text>
              <View style={s.notesBox}>
                <Text style={s.notesLabel}>Note from Guest</Text>
                <Text style={s.notesText}>{data.guestNotes}</Text>
              </View>
            </>
          )}

          {/* Notice */}
          <View style={s.noticeBox}>
            <Text style={s.noticeText}>
              {data.paymentMethod === "CASH"
                ? "This is a booking request. Your reservation will be confirmed by our team shortly. Payment is due at the reception upon arrival. Please present this document at check-in."
                : "Your reservation is confirmed. Please present this document at check-in. For any changes or inquiries, contact us at +968 99551237 or WhatsApp."}
            </Text>
          </View>

        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>+968 99551237 · nassayem.com · Salalah, Dhofar, Oman</Text>
          <Text style={s.footerBrand}>Nassayem Salalah</Text>
        </View>

      </Page>
    </Document>
  );
}

// ── Public function: generate PDF buffer ──────────────────────────────────────

export async function generateBookingPdf(data: BookingPdfData): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <BookingConfirmationDocument data={data} />,
  );
  return Buffer.from(buffer);
}
