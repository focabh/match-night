-- Bucket público de fotos do Match Night (isolado: id mn-photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mn-photos','mn-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,
  file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- políticas: anon faz upload e leitura SÓ no bucket mn-photos (não toca em outros).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='mn_anon_upload') then
    create policy "mn_anon_upload" on storage.objects for insert to anon, authenticated
      with check (bucket_id='mn-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='mn_public_read') then
    create policy "mn_public_read" on storage.objects for select to anon, authenticated
      using (bucket_id='mn-photos');
  end if;
end $$;
select 'mn-photos bucket ok' as status;
