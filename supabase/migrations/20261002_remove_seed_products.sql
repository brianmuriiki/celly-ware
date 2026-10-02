update public.kv_store_f5814922
set value = (
  select coalesce(jsonb_agg(product), '[]'::jsonb)
  from jsonb_array_elements(value) as products(product)
  where coalesce(product->>'id', '') not in (
    'celly-001',
    'celly-002',
    'celly-003',
    'celly-004',
    'celly-005',
    'celly-006'
  )
)
where key = 'products'
  and jsonb_typeof(value) = 'array';
