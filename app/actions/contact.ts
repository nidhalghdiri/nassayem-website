"use server";

import { Resend } from "resend";
import { z } from "zod";
import { CONTACT_EMAIL } from "@/lib/contact";

// Initialise Resend lazily so a missing env var only throws at send-time.
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set.");
  return new Resend(key);
}

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(5).max(5000),
});

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function submitContactForm(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const locale = (formData.get("locale") as string) || "en";
  const isEn = locale !== "ar";

  // Honeypot: real users never fill a hidden field, bots usually do.
  if ((formData.get("company") as string)?.trim()) {
    return { status: "success", message: isEn ? "Thank you." : "شكراً لك." };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: isEn
        ? "Please enter your name, a valid email address, and a message."
        : "يرجى إدخال الاسم وبريد إلكتروني صحيح ورسالتك.",
    };
  }

  const { name, phone, email, message } = parsed.data;

  const html = `
    <h2>New contact enquiry — nassayem.com</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
    <p><strong>Language:</strong> ${isEn ? "English" : "Arabic"}</p>
    <hr />
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  try {
    const { error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? "Nassayem Salalah <bookings@nassayem.com>",
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `New enquiry from ${name}`,
      html,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[contact] send failed:", err);
    return {
      status: "error",
      message: isEn
        ? "Sorry, we couldn't send your message. Please call or WhatsApp us instead."
        : "عذراً، تعذر إرسال رسالتك. يرجى الاتصال بنا أو مراسلتنا عبر واتساب.",
    };
  }

  return {
    status: "success",
    message: isEn
      ? "Thank you — your message has been sent. We'll be in touch shortly."
      : "شكراً لك — تم إرسال رسالتك وسنتواصل معك قريباً.",
  };
}
