const { Client } = require("pg");

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database...");

    await client.query(`
      ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "stage" text NOT NULL DEFAULT 'proofing';
      ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "max_selections" integer;
      ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "section" text NOT NULL DEFAULT 'proofing';
    `);

    console.log("Migration completed successfully: added stage, max_selections, section columns.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

migrate();
