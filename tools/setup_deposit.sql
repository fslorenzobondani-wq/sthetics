-- Incolla tutto questo nell'SQL Editor di Supabase ed esegui (una volta).
create table if not exists deposits (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  status      text not null default 'pending',   -- pending | approved | rejected
  specimen_id text not null,
  slot        text not null,
  src         text not null,
  page_url    text,
  title       text,
  author      text,
  license     text,
  year        int,
  aspect      real,
  ai          jsonb
);

alter table deposits enable row level security;

-- I visitatori vedono solo le immagini approvate.
create policy "leggi approvate" on deposits
  for select to anon using (status = 'approved');

-- I visitatori possono solo aggiungere righe "pending" ben formate. Non possono modificare né cancellare.
create policy "deposita in attesa" on deposits
  for insert to anon with check (
    status = 'pending'
    and specimen_id ~ '^[0-9]{3}$'
    and slot in ('fashion', 'design', 'material', 'space')
    and src like 'https://%' and length(src) < 1000
    and (title is null or length(title) < 300)
  );

-- Per approvare: nel Table Editor apri la tabella deposits e cambia status da pending ad approved.
