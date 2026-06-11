# API Documentation
## Income/Expense Management System

**Base URL:** `http://localhost:5000/api`
**Auth:** All protected endpoints require `Authorization: Bearer <token>`

**Response format:**
```json
// Success (single)
{ "success": true, "data": { ... } }

// Success (list)
{ "success": true, "data": [...], "pagination": { "total": 0, "page": 1, "limit": 10, "total_pages": 0 } }

// Error
{ "success": false, "error": "Descriptive error message" }
```

---

## 1. Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create new account |
| POST | `/auth/login` | No | Login, returns access token + sets httpOnly cookie |
| POST | `/auth/refresh` | Cookie | Exchange refresh cookie for new access token |
| POST | `/auth/logout` | Yes | Revoke refresh token and clear cookie |
| GET  | `/auth/me` | Yes | Get current user profile (no password) |
| PATCH | `/auth/me/password` | Yes | Change own password |

### POST /auth/register
```json
// Request body
{ "username": "john", "email": "john@example.com", "password": "secret123" }

// Response 201
{ "success": true, "data": { "id": "clx...", "username": "john", "email": "john@example.com", "role": "USER" } }

// Errors
// 400 — username < 3 chars, invalid email, password < 8 chars
// 409 — email already registered
```

### POST /auth/login
```json
// Request body
{ "email": "john@example.com", "password": "secret123" }

// Response 200
{ "success": true, "data": { "access_token": "eyJ...", "user": { "id": "...", "username": "john", "role": "USER", "ai_daily_limit": 10 } } }

// Errors
// 401 — wrong email or password
// 401 — account deactivated
```

### PATCH /auth/me/password
```json
// Request body
{ "current_password": "old_pass", "new_password": "new_pass123" }

// Response 200
{ "success": true, "data": { "message": "Password updated successfully" } }

// Errors
// 400 — current password incorrect
// 400 — new password less than 8 characters
```

---

## 2. Records

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/records` | Yes | Create a record |
| GET  | `/records` | Yes | List + search + paginate |
| GET  | `/records/generate-id` | Yes | Get suggested unique record ID |
| GET  | `/records/export` | Yes | Download CSV export |
| GET  | `/records/:id` | Yes | Get single record |
| PUT  | `/records/:id` | Yes | Update record (ID field is ignored/stripped) |
| DELETE | `/records/:id` | Yes | Soft-delete a record |
| DELETE | `/records/bulk` | Yes | Bulk soft-delete |
| POST | `/records/:id/restore` | ADMIN | Restore soft-deleted record |
| DELETE | `/records/:id/hard` | ADMIN | Permanently delete a record |

### GET /records — Query Parameters
```
?record_id=REC001    — filter by record ID (partial match)
&type=income         — filter by type: income | expense
&category_id=clx...  — filter by category ID
&date_from=2026-01-01
&date_to=2026-12-31
&page=1
&limit=10
```

### POST /records
```json
// Request body
{
  "id": "REC001",
  "type": "income",
  "amount": 1500.00,
  "category_id": "clx...",
  "date": "2026-06-01",
  "operator": "John",
  "notes": "Monthly salary"
}

// Response 201
{ "success": true, "data": { "id": "REC001", "type": "income", ... } }

// Errors
// 400 — missing required fields
// 409 — Record ID already exists
```

---

## 3. Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/categories` | Yes | Active system categories + user's personal categories |
| POST | `/categories/user` | Yes | Create a personal category |
| PUT  | `/categories/user/:id` | Yes | Update a personal category |
| DELETE | `/categories/user/:id` | Yes | Delete a personal category (409 if records use it) |
| GET  | `/admin/categories` | ADMIN | All system categories including inactive |
| POST | `/admin/categories` | ADMIN | Create a system category |
| PUT  | `/admin/categories/:id` | ADMIN | Update a system category |
| DELETE | `/admin/categories/:id` | ADMIN | Deactivate a system category |

---

## 4. Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/analytics/summary` | Yes | Income, expense, net balance totals |
| GET | `/analytics/trends` | Yes | Monthly income vs expense over N months |
| GET | `/analytics/categories` | Yes | Expense breakdown by category with % |
| GET | `/analytics/daily` | Yes | Day-by-day running balance |
| GET | `/analytics/system` | ADMIN | Platform-wide totals |

### GET /analytics/summary — Query Parameters
```
?month=6&year=2026           — specific month/year
?date_from=2026-01-01&date_to=2026-06-30  — custom date range
```

### Response Example
```json
{ "success": true, "data": { "total_income": 5000.00, "total_expense": 3200.00, "net_balance": 1800.00, "record_count": 42 } }
```

---

## 5. AI Features

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/plan` | Yes | Generate AI monthly budget plan |
| POST | `/ai/advise` | Yes | Check purchase affordability |
| POST | `/ai/analyze` | Yes | Free-form financial Q&A |
| GET  | `/ai/usage` | Yes | Current user's daily usage count |
| GET  | `/ai/usage/all` | ADMIN | All users' usage log |

### POST /ai/plan
```json
// Request body
{ "target_budget": 3000, "month": 6, "year": 2026 }

// Response 200
{ "success": true, "data": [
  { "category_name": "Food", "suggested_amount": 600, "percentage": 20, "reason": "Based on your last 3 months average." }
]}
```

### POST /ai/advise
```json
// Request body
{ "item_name": "MacBook Pro", "item_cost": 2499, "planned_date": "2026-08-01" }

// Response 200
{ "success": true, "data": { "verdict": "wait", "reasoning": "...", "months_to_save": 3 } }
```

### POST /ai/analyze
```json
// Request body
{ "question": "What are my biggest expense categories this year?" }

// Response 200
{ "success": true, "data": { "answer": "...", "key_insights": ["...", "..."] } }
```

### GET /ai/usage
```json
{ "success": true, "data": { "non_cached_today": 3, "cached_today": 1, "daily_limit": 10, "remaining": 7 } }
```

---

## 6. Budget Goals

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/budget-goals` | Yes | Get goals with actual spending for a month/year |
| PUT  | `/budget-goals` | Yes | Save goals (supports replace mode) |
| DELETE | `/budget-goals/:id` | Yes | Remove a single goal |

### GET /budget-goals — Query Parameters
```
?month=6&year=2026
```

---

## 7. Admin — Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/admin/users` | ADMIN | Paginated user list |
| GET  | `/admin/users/:id` | ADMIN | Single user with stats |
| PATCH | `/admin/users/:id/toggle` | ADMIN | Activate / deactivate account |
| PATCH | `/admin/users/:id/role` | ADMIN | Change role (USER \| ADMIN) |
| PATCH | `/admin/users/:id/note` | ADMIN | Add admin note to user |

---

## 8. Admin — Records

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/records/:user_id` | ADMIN | All records for a user including soft-deleted |

---

## 9. Admin — Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/dashboard` | ADMIN | Platform health metrics (users, records, AI usage) |

---

## Error Reference

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| 400 | Bad Request | Validation failed (missing field, bad format) |
| 401 | Unauthorized | Missing or expired access token |
| 403 | Forbidden | Wrong role or account deactivated |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate Record ID or email |
| 429 | Too Many Requests | Daily AI limit reached |
| 502 | Bad Gateway | Gemini API unavailable |
