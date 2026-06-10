import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  migrate: {
    adapter: async () => {
      const { PrismaPostgres } = await import('@prisma/adapter-postgresql')
      return new PrismaPostgres({ url: process.env.DATABASE_URL! })
    },
  },
})
