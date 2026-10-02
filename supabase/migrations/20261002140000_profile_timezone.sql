-- The coach connector needs the user's time zone to know what "today" and "this morning" mean.
alter table public.profiles add column timezone text not null default 'Asia/Kolkata';
