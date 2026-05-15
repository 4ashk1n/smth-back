import { PrismaService } from '../../src/prisma/prisma.service';

type TableRow = { tablename: string };

export async function clearDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<TableRow[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (!tables.length) return;

  const tableList = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
}
