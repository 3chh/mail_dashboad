import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.account.deleteMany()
  console.log(`Deleted ${result.count} accounts to force OAuth token refresh.`)
}

main().finally(() => prisma.$disconnect())
