-- ════════════════════════════════════════════════════════════════════════════
-- InterestMe — Allow email-less (anonymous/guest) users in public.users
--
-- handle_new_user() mirrors auth.users into public.users, inserting new.email.
-- Anonymous users have email = NULL, but public.users.email was NOT NULL, so the
-- trigger crashed and the anonymous sign-in 500'd. Guests legitimately have no
-- email until they convert, so make the column nullable. (Unique still holds —
-- Postgres treats NULLs as distinct, so multiple guests are fine.)
-- Run after 0004.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.users alter column email drop not null;
