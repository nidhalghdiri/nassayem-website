-- RLS for AI chatbot tables. Deny-all by default: no policies are created, so
-- the Supabase anon/authenticated roles (PostgREST) cannot read or write these
-- tables at all. The app accesses them exclusively through Prisma, which
-- connects as the table owner and therefore bypasses RLS.
-- Applied 2026-07-05 via: npx prisma db execute --file prisma/sql/chatbot_rls.sql
ALTER TABLE "ChatbotConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatbotMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatbotLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatbotConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatbotHold" ENABLE ROW LEVEL SECURITY;
