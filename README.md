This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## AI Chatbot (Claude)

A grounded, tool-calling assistant (web widget + WhatsApp) that answers customer questions in Arabic (Gulf dialect + Arabizi) and English using **live data only** — availability, pricing (incl. promotions and the Khareef gate), buildings and photos all come from the same functions the website itself uses. Admin panel at `/{locale}/admin/chatbot`.

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (required) |
| `AI_MODEL` | Claude model id. Default: `claude-opus-4-8`. Swap without redeploying code (e.g. `claude-haiku-4-5` to cut cost) |
| `WHATSAPP_ACCESS_TOKEN` | Existing — WhatsApp Cloud API token (also used by task notifications) |
| `WHATSAPP_PHONE_NUMBER_ID` | Existing — WhatsApp Cloud API phone number id |
| `WHATSAPP_VERIFY_TOKEN` | New — any random string; must match the webhook "Verify token" in Meta |
| `WHATSAPP_APP_SECRET` | New — Meta App secret, used to verify webhook signatures |
| `EMAIL_FROM` / `RESEND_API_KEY` | Existing — reused for escalation email notifications |
| `NEXT_PUBLIC_BASE_URL` | Existing — used to build property links the bot shares |

### Architecture

- `lib/ai/provider.ts` — Anthropic Messages API wrapper (model via `AI_MODEL`).
- `lib/chatbot/agent.ts` — shared orchestration: history + live config + tool loop (max 5 iterations) + persistence. Same core for web, playground and WhatsApp; only transport differs.
- `lib/chatbot/tools.ts` — 8 zod-validated tools reusing `checkUnitAvailability`, `calculateBookingPrice`, promotions queries. Soft holds (30 min) reduce availability in chatbot answers only — the public checkout flow is untouched.
- `app/api/chatbot/web` — public streaming endpoint (ND-JSON) + widget bootstrap. Rate-limited per session (8/min, 150/day) via DB counts.
- `components/chatbot/ChatWidget.tsx` — floating widget mounted site-wide in `app/[locale]/layout.tsx` (RTL-aware, hidden on admin pages, hidden when the bot is disabled in config).
- Data: `ChatbotConversation/Message/Lead/Config/Hold` Prisma models; RLS enabled deny-all (`prisma/sql/chatbot_rls.sql`) so Supabase anon/PostgREST cannot touch them.

### Editing the bot's behavior (no redeploy)

`/{locale}/admin/chatbot/config` (managers only): system prompt/persona, tone, business rules, escalation triggers, canned replies, contact numbers, widget greetings, **Show prices** toggle (off = bot never quotes prices, directs to call center) and the master **Enabled** switch. Changes go live within ~1 minute. Grounding/safety rules are hardcoded in `lib/chatbot/prompt.ts` and cannot be weakened from the admin.

Test changes in `/{locale}/admin/chatbot/playground` before customers see them.

### WhatsApp webhook setup (Meta)

1. In Meta for Developers → your app → WhatsApp → Configuration, set the callback URL to `https://www.nassayem.com/api/chatbot/whatsapp` and the Verify token to the value of `WHATSAPP_VERIFY_TOKEN`, then click Verify.
2. Subscribe to the `messages` webhook field.
3. Ensure `WHATSAPP_APP_SECRET` matches the App secret (App settings → Basic) — inbound requests are signature-checked.

Inbound customer messages open WhatsApp's 24-hour customer-service window, so the bot replies with free-form messages (no templates needed).
