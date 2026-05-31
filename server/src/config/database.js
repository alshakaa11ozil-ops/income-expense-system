// =============================================================================
// FILE:    src/config/database.js
// LAYER:   Config
// PURPOSE: Export a single shared PrismaClient instance for the entire app.
//          Prevents connection pool exhaustion from multiple instantiations.
// DEPENDS: @prisma/client (generated), DATABASE_URL env var
// EXPORTS: prisma — the singleton PrismaClient instance
// =============================================================================

"use strict";

const { PrismaClient } = require("@prisma/client");

/**
 * WHY: PrismaClient manages a connection pool. Creating multiple instances
 *      (e.g. one per module) exhausts the pool and causes "too many clients"
 *      errors in PostgreSQL. A module-level singleton is the standard fix.
 *
 * HOW: Node.js caches require() calls, so this file is only executed once.
 *      Every module that does require('./config/database') receives the same
 *      object reference — no duplication.
 *
 * @returns {PrismaClient} The shared Prisma client instance
 */
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["warn", "error"],
});

module.exports = prisma;