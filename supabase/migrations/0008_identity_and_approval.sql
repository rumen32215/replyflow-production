-- ReplyFlow — 0008: business identity, draft-job approval, storage
--
-- Three independent additions for this round:
--   1. receptionist_name — nullable; unnamed stays neutral ("your
--      receptionist"), named threads the name through the product.
--   2. jobs.status gains 'draft' — bookings created from a
--      conversation now start as a draft the owner must approve,
--      never auto-finalised. Same widen-the-allow-list pattern
--      already used for conversations.status in 0006.
--   3. A public "business-assets" Storage bucket for logo uploads —
--      the first Storage usage anywhere in this project. RLS keyed by
--      business_id as the path prefix, matching the ownership
--      boundary every other policy in this app already uses
--      (business_id in (select id from businesses where owner_id =
--      auth.uid())), not a second auth.uid()-based model.

alter table public.businesses
  add column if not exists receptionist_name text;

alter table public.jobs
  drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
  check (status in (
    'draft',
    'new_enquiry',
    'quote_requested',
    'quote_sent',
    'quote_accepted',
    'booked',
    'in_progress',
    'completed',
    'cancelled'
  ));

insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view business assets" on storage.objects;
create policy "Anyone can view business assets"
  on storage.objects for select
  using (bucket_id = 'business-assets');

drop policy if exists "Owners can upload their own business assets" on storage.objects;
create policy "Owners can upload their own business assets"
  on storage.objects for insert
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can update their own business assets" on storage.objects;
create policy "Owners can update their own business assets"
  on storage.objects for update
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select id from public.businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can delete their own business assets" on storage.objects;
create policy "Owners can delete their own business assets"
  on storage.objects for delete
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select id from public.businesses where owner_id = auth.uid())
  );

notify pgrst, 'reload schema';
