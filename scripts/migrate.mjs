import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

if (process.env.DATABASE_URL) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  try {
    await client.connect()
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" })
    console.log("Migrations applied successfully")
  } catch (err) {
    console.error("Migration failed:", err)
    process.exitCode = 1
  } finally {
    await client.end().catch(() => {})
  }
} else {
  console.log("No DATABASE_URL found, skipping startup migration.")
}

