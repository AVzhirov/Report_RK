import { PrismaClient } from '@prisma/client'

// Fallback: если .env не загрузился (частая проблема на Windows с PowerShell),
// используем дефолтный путь к SQLite. Для боевого MS SQL задайте MSSQL_* в .env.local
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./db/custom.db'
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
