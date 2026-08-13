-- Table for analysis history snapshots
create table if not exists analysis_history (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid not null,
  module text not null, -- 'voice', 'language', 'swallowing'
  risk_level text not null,
  action_level text not null,
  summary_family text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table analysis_history enable row level security;

-- Policy for all access (adjust for production)
create policy "Enable all access for all users" on analysis_history
  for all using (true) with check (true);

-- Index for faster timeline queries
create index if not exists analysis_history_patient_module_idx on analysis_history (patient_id, module, timestamp);
