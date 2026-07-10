import { PrismaClient } from '@prisma/client'
import path from 'path'

// Fallback: если .env не загрузился (частая проблема на Windows с PowerShell),
// используем абсолютный путь к SQLite.
//
// ВАЖНО: Prisma 6.x для SQLite интерпретирует ОТНОСИТЕЛЬНЫЙ путь в DATABASE_URL
// относительно папки prisma/ (где лежит schema.prisma), а не корня проекта.
// Поэтому `file:./db/custom.db` создаст БД в prisma/db/custom.db, а не в db/custom.db.
// Используем АБСОЛЮТНЫЙ путь — тогда БД будет в правильном месте.
//
// Для боевого MS SQL задайте MSSQL_* в .env.local (см. SETUP-WINDOWS.md)
if (!process.env.DATABASE_URL) {
  // __dirname в Next.js Turbopack указывает на .next/dev/server/lib/, поднимаемся к корню
  // process.cwd() — это корень проекта (откуда запущен npm run dev)
  const dbPath = path.join(process.cwd(), 'db', 'custom.db')
  process.env.DATABASE_URL = `file:${dbPath}`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
