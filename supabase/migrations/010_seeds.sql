insert into public.nutrition_knowledge_sources (title, source_type, source_reference, category, tags, language, status)
values (
  'Guia Base de Nutrição Prática',
  'manual_interno',
  'kronia://seed/guia-base',
  'educacao_alimentar',
  array['base', 'educacao_alimentar', 'adesao_ao_plano'],
  'pt-BR',
  'active'
)
on conflict do nothing;

with source_row as (
  select id from public.nutrition_knowledge_sources where source_reference = 'kronia://seed/guia-base' limit 1
), doc_row as (
  insert into public.nutrition_knowledge_documents (source_id, title, document_text, checksum, version)
  select
    source_row.id,
    'Princípios para aderência ao plano alimentar',
    'Aderência melhora com planejamento de refeições, hidratação diária e monitoramento semanal de progresso. Substituições inteligentes ajudam a manter consistência sem comprometer objetivos.',
    'seed-doc-001-principios-aderencia',
    '1.0.0'
  from source_row
  on conflict (checksum) do update set updated_at = now()
  returning id, source_id
)
insert into public.nutrition_knowledge_chunks (document_id, source_id, chunk_index, content, category, subcategory, tags, metadata, embedding)
select
  doc_row.id,
  doc_row.source_id,
  chunks.idx,
  chunks.content,
  chunks.category,
  chunks.subcategory,
  chunks.tags,
  chunks.metadata,
  ('[' || array_to_string(array_fill(0.001::float8, array[1536]), ',') || ']')::vector
from doc_row
cross join (
  values
    (0, 'Manter horários de refeições previsíveis melhora adesão e reduz decisões impulsivas.', 'adesao_ao_plano', 'rotina', array['adesao_ao_plano','rotina']::text[], '{"source":"seed"}'::jsonb),
    (1, 'Metas de hidratação devem ser distribuídas ao longo do dia para facilitar execução.', 'educacao_alimentar', 'hidratacao', array['educacao_alimentar','hidratacao']::text[], '{"source":"seed"}'::jsonb),
    (2, 'Substituições alimentares de densidade calórica semelhante evitam ruptura do planejamento.', 'substituicoes_alimentares', 'equivalencias', array['substituicoes_alimentares','planejamento']::text[], '{"source":"seed"}'::jsonb)
) as chunks(idx, content, category, subcategory, tags, metadata)
on conflict (document_id, chunk_index) do nothing;
