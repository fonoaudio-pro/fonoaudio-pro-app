-- Table for storing sync tokens for various external services
create table if not exists user_sync_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  module text not null, -- e.g., 'google_calendar'
  token text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table user_sync_tokens enable row level security;

-- Policy: Users can only manage their own sync tokens
create policy "Users can manage their own sync tokens" on user_sync_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index for fast lookup by user and module
create index if not exists idx_user_sync_tokens_user_module on user_sync_tokens (user_id, module);
