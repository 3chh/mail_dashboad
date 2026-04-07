import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const accounts = await prisma.account.findMany()
  fs.writeFileSync('db_output2.json', JSON.stringify(accounts, null, 2), 'utf8')
}

main().finally(() => prisma.$disconnect())
