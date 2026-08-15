import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

if (process.env.DATABASE_URL) {
  try {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" })
    await client.end()
    console.log("Migrations applied successfully")
  } catch (err) {
    console.warn("Migration notice:", err.message)
  }
} else {
  console.log("No DATABASE_URL found, skipping startup migration.")
}

