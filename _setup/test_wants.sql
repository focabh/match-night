-- reciprocidade mn_wants (prefs[], gender) — conforme documento aprovado
select
  mn_wants(array['men'],'man')                    as h_quer_h_eh_m_TRUE,     -- t
  mn_wants(array['women'],'man')                   as quer_mulher_eh_homem_F, -- f
  mn_wants(array['all'],'nonbinary')               as todos_ve_NB_TRUE,       -- t
  mn_wants(array['women','nonbinary'],'man')       as multi_sem_homem_F,      -- f
  mn_wants(array['women','nonbinary'],'nonbinary') as multi_com_NB_TRUE,      -- t
  mn_wants(array['all'],'other')                   as todos_ve_outro_TRUE,    -- t
  mn_wants(array['women'],'other')                 as quer_mulher_eh_outro_F, -- f
  mn_wants(array[]::text[],'man')                  as vazio_sem_filtro_TRUE;  -- t
