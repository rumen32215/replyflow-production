-- ReplyFlow — 0014: Handover confirmation (ReplyFlow v1 Product
-- Blueprint, implementation checklist 3.1)
--
-- "Meet Your Receptionist" (lib/receptionist-handover.ts) asks the
-- owner to confirm "Have I understood your business correctly?" —
-- until now that confirmation was pure client-side React state,
-- never written anywhere. Checklist 2.7 repositions this page as the
-- third step of Front Desk's Setup Journey checklist, which needs a
-- real, durable "done" signal for that step — the same discipline
-- this product applies everywhere else: a checklist item's completion
-- is a stored fact, never a guess or a flag that resets on refresh.

alter table public.businesses
  add column if not exists handover_confirmed_at timestamptz;

notify pgrst, 'reload schema';
