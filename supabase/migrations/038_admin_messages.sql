create table if not exists admin_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  title      text not null,
  body       text not null,
  sent_by    uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table admin_messages enable row level security;
create policy "users read own or broadcast" on admin_messages
  for select using (user_id is null or user_id = auth.uid());
create policy "admins insert" on admin_messages
  for insert with check (
    exists (select 1 from user_profiles where id = auth.uid() and is_admin = true)
  );

create table if not exists admin_message_reads (
  message_id uuid references admin_messages(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  read_at    timestamptz default now(),
  primary key (message_id, user_id)
);
alter table admin_message_reads enable row level security;
create policy "users manage own reads" on admin_message_reads
  for all using (user_id = auth.uid());
