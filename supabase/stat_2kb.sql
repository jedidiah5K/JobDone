-- v200 (Job, 15 Nov): a party card (stat.lv with Match/catch-up fields, v194) is ~1.4 KB, over the old 1 KB cap,
-- so every invite save was rejected and no push went out. 2 KB fits a full 6-person party; the app trims at 880 chars.
alter table public.jobdone_cards drop constraint jobdone_cards_stat_check,
  add constraint jobdone_cards_stat_check check (stat is null or pg_column_size(stat) < 2048);
