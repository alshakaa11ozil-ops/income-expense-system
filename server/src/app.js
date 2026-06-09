// =============================================================================
// FILE:    src/app.js
// LAYER:   Application Bootstrap
// PURPOSE: Configure the Express application — middleware stack, route
//          mounting, and global error handling. Does NOT start the server
//          (that lives in server.js) so the app is testable in isolation.
// DEPENDS: express, helmet, cors, cookie-parser, express-mongo-sanitize,
//          express-rate-limit, dotenv, all route files
// EXPORTS: app — configured Express application instance
// =============================================================================

"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const morgan = require("morgan");
const { sanitize } = require("./middleware/sanitize");
const { error_handler } = require("./middleware/error_handler");

const app = express();

// ---------------------------------------------------------------------------
// LOGGING & COMPRESSION
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
}
app.use(compression());

// ---------------------------------------------------------------------------
// SECURITY MIDDLEWARE
// WHY: Applied before any route so every request is covered.
// ---------------------------------------------------------------------------

/**
 * WHY: helmet sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
 *      in one call — prevents a wide class of web vulnerabilities.
 * HOW: Wraps ~15 smaller middleware functions behind a single app.use().
 */
app.use(helmet());

/**
 * WHY: Restrict which origins can call this API in browser contexts.
 * HOW: Reads allowed origin from env; enables credentials for cookie-based
 *      refresh tokens; explicitly lists allowed headers.
 */
app.use(
    cors({
        origin: (origin, callback) => {
            const allowed = [
                process.env.CLIENT_URL || 'http://localhost:3000',
                'http://localhost:5173', // Vite dev server
            ];
            // allow requests with no origin (curl, Postman, etc.)
            if (!origin || allowed.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Not allowed by CORS: ${origin}`));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

/**
 * WHY: Global rate limiter protects all endpoints from brute-force and
 *      denial-of-service attacks without needing per-route configuration.
 * HOW: express-rate-limit tracks requests by IP using an in-memory store.
 *      Tighter limits are applied per-route on sensitive endpoints (auth).
 *
 * @param {number} windowMs - Rolling window in milliseconds (15 min)
 * @param {number} max      - Maximum requests per window per IP
 */
const global_limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later." },
});
app.use(global_limiter);

// ---------------------------------------------------------------------------
// BODY PARSING MIDDLEWARE
// ---------------------------------------------------------------------------

/**
 * WHY: Parse incoming JSON bodies so controllers receive req.body as an object.
 * HOW: Built-in Express middleware; limit set to prevent oversized payloads.
 */
app.use(express.json({ limit: "10kb" }));

/**
 * WHY: Parse URL-encoded bodies (HTML form submissions).
 */
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(sanitize);
/**
 * WHY: Parse Cookie header and populate req.cookies — required for reading
 *      the httpOnly refresh token cookie sent by the auth service.
 */
app.use(cookieParser());

// ---------------------------------------------------------------------------
// SANITIZATION MIDDLEWARE
// WHY: express-mongo-sanitize strips keys that start with '$' or contain '.'
//      from req.body, req.query, and req.params. Prevents NoSQL injection
//      patterns even though we use PostgreSQL — defense in depth.
// ---------------------------------------------------------------------------
app.use(mongoSanitize());

// ---------------------------------------------------------------------------
// HEALTH CHECK
// WHY: Allows load balancers and monitoring tools to verify the app is alive
//      without touching any database or business logic.
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, message: "Server is running." });
});

// ---------------------------------------------------------------------------
// ROUTE MOUNTING
// WHY: Centralised prefix mounting keeps controllers thin and URLs consistent.
// HOW: Each router file handles its own sub-routes.
// ---------------------------------------------------------------------------

const auth_routes = require("./routes/auth_routes");

// ── Chat 3 routes ──────────────────────────────────────────
const record_routes = require("./routes/record_routes");
const category_routes = require("./routes/category_routes");
const admin_routes = require("./routes/admin_routes");
const budget_goal_routes = require("./routes/budget_goal_routes");
const analytics_routes = require('./routes/analytics_routes');

// ── Chat 5 routes ──────────────────────────────────────────
const ai_routes = require('./routes/ai_routes');

app.use("/api/auth", auth_routes);

// WHY /api not /api/records:
// Route files already define full paths (/records, /admin/...).
// Mounting at /api avoids double-nesting the prefix.
app.use("/api", record_routes);
app.use("/api", category_routes);
app.use("/api", admin_routes);
app.use("/api", budget_goal_routes);
app.use('/api', analytics_routes);
app.use('/api', ai_routes);


// ---------------------------------------------------------------------------
// 404 HANDLER
// WHY: Catches any request that didn't match a route above and returns a
//      structured JSON response instead of Express's default HTML error page.
// ---------------------------------------------------------------------------
app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Route not found." });
});

// ---------------------------------------------------------------------------
// GLOBAL ERROR HANDLER
// WHY: Delegates to error_handler.js which handles 429 (AI limits + reset_at),
//      502 (Gemini upstream), 401/403/404/400, Prisma P2002/P2025,
//      budget goal policy errors, AI_ prefix errors, and 500 fallback.
//      MUST be registered after all routes — Express uses 4-arg signature
//      to identify error middleware.
// ---------------------------------------------------------------------------
app.use(error_handler);

// ── Scheduled cleanup ────────────────────────────────────────
// Every 6 hours — keeps refresh_token and ai_cache tables from
// growing unbounded. ai_cache cleanup added in Chat 5.
const refresh_token_model = require("./models/refresh_token_model");
const ai_cache_model = require("./models/ai_cache_model");

setInterval(async () => {
    try {
        const [expired_tokens, expired_cache] = await Promise.all([
            refresh_token_model.delete_expired(),
            ai_cache_model.delete_expired(),
        ]);
        if (process.env.NODE_ENV === "development") {
            console.log(
                `[Cleanup] Deleted ${expired_tokens} refresh token(s), ` +
                `${expired_cache} AI cache entr${expired_cache === 1 ? "y" : "ies"}`
            );
        }
    } catch (err) {
        console.error("[Cleanup] Failed:", err.message);
    }
}, 6 * 60 * 60 * 1000);

module.exports = app;