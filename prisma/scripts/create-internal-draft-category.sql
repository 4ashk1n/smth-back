INSERT INTO "categories" ("id", "name", "emoji", "colors", "createdAt", "updatedAt")
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '__internal_draft__',
  '_',
  '{"lightColor":"#f3f4f6","darkColor":"#111827","accentColor":"#9ca3af"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO NOTHING;
