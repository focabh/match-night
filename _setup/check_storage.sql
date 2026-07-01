select 'buckets' as t, id, name, public::text from storage.buckets
union all
select 'policy', policyname, cmd, roles::text from pg_policies where schemaname='storage' and tablename='objects'
order by 1;
