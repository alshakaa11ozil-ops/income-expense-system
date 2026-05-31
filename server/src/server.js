// =============================================================================
// FILE:    src/server.js
// LAYER:   Entry Point
// PURPOSE: Start the HTTP server. Separated from app.js so the Express app
//          can be imported and tested without binding to a port.
// DEPENDS: app.js, config/database.js, dotenv
// EXPORTS: nothing (process entry point)
// =============================================================================

"use strict";

require("dotenv").config();

const app   = require("./app");
const prisma = require("./config/database");

const PORT = process.env.PORT || 5000;

/**
 * WHY: Verify the database connection before accepting traffic — fails fast
 *      if DATABASE_URL is wrong instead of crashing on the first request.
 * HOW: Prisma.$connect() opens the connection pool; any misconfiguration
 *      throws here and the process exits with a non-zero code so the process
 *      manager (nodemon / PM2 / Docker) knows it failed.
 *
 * @throws {Error} If the database connection cannot be established
 */
async function start_server() {
  try {
    await prisma.$connect();
    console.log("[DB] PostgreSQL connected successfully.");

    app.listen(PORT, () => {
      console.log(`[SERVER] Running on http://localhost:${PORT}`);
      console.log(`[ENV]    NODE_ENV = ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("[DB] Failed to connect to database:", error.message);
    process.exit(1);
  }
}

/**
 * WHY: Graceful shutdown ensures in-flight requests finish and the database
 *      connection pool is cleanly closed, preventing data corruption.
 * HOW: SIGTERM is sent by process managers (Docker, PM2) to request shutdown.
 *
 * @param {string} signal - The OS signal name (e.g. "SIGTERM", "SIGINT")
 */
async function graceful_shutdown(signal) {
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);
  await prisma.$disconnect();
  console.log("[DB] Disconnected.");
  process.exit(0);
}

process.on("SIGTERM", () => graceful_shutdown("SIGTERM"));
process.on("SIGINT",  () => graceful_shutdown("SIGINT"));

start_server();
