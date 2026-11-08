-- Story and stamp photos may be up to 250 KB (was 120 KB). Applied to the live database 8 Nov 2026.
alter table public.jobdone_posts drop constraint jobdone_posts_photo_check;
alter table public.jobdone_posts add constraint jobdone_posts_photo_check check (photo is null or (length(photo) < 250000 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'));
