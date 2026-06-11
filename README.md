# Income/Expense Management System

> University project — Q13 Income/Expense Management  
> Built with React, Node.js/Express, PostgreSQL following strict MVC architecture

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Tailwind CSS + Recharts |
| Backend | Node.js + Express.js |
| Architecture | MVC (Model → Service → Controller) |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access token) + Refresh Token (httpOnly cookie) |
| Password | bcrypt (saltRounds = 12) |
| AI | Anthropic Claude API |

---

## MVC Architecture

```
client/src/                        SERVER: MVC LAYERS
├── pages/          ←── VIEW       src/controllers/   ←── CONTROLLER
├── components/     ←── VIEW       src/services/      ←── BUSINESS LOGIC
└── services/api.js ←── HTTP       src/models/        ←── DATA ACCESS
                                   prisma/schema.prisma ← DATABASE
```

---

## Features

### Core (Teacher Requirements — Q13)
- **Add** records with duplicate ID check and mandatory field validation
- **Edit** records — Record ID is permanently fixed after creation
- **Delete** records directly from the list view
- **Search** by record ID, type, category with server-side pagination

### Authentication
- JWT access tokens (15 min) + refresh tokens (7-day httpOnly cookie)
- bcrypt password hashing (saltRounds = 12)
- Role-based access: USER and ADMIN roles
- Rate limiting on auth endpoints
- User profile page with self-service password change

### Dashboard
- Summary cards: total income, total expense, net balance (current month)
- Line chart: income vs expense over last 6 months
- Pie chart: spending breakdown by category
- Recent 5 records with View All link

### Categories
- 27 built-in system categories with icons and colors
- Personal categories per user with monthly spending limits
- Progress bars track actual vs planned spending

### AI Features (Google Gemini Flash)
- **Budget Planner** — AI suggests monthly allocations, user saves as goals
- **Purchase Advisor** — affordability verdict with savings timeline
- **Finance Chat** — free-form Q&A with full financial context
- DB-backed response caching — repeated questions served instantly
- Daily limits: 10/day (USER), 50/day (ADMIN)

### Admin Panel
- User management: promote roles, activate/deactivate accounts
- Audit view: any user's records including soft-deleted ones
- Restore soft-deleted records or permanently remove them
- Platform analytics and AI usage reporting

### Extras
- Export records to CSV
- Date range filtering with quick buttons
- Bulk delete with checkboxes

---

## Setup Instructions

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/alshakaa11ozil-ops/income-expense-system.git
cd income-expense-system
```

### 2. Install dependencies
```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 3. Configure environment variables
```bash
cd server
cp .env.example .env
# Edit .env with your database URL, JWT secrets, and API key
```

### 4. Set up the database
```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Run the project
```bash
# From root — run both at once
cd server && npm run dev     # Backend on :5000
cd client && npm run dev     # Frontend on :5173
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/income_expense_db` |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | random 64-char string |
| `JWT_ACCESS_EXPIRY` | Access token lifetime | `15m` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | different random 64-char string |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime | `7d` |
| `PORT` | Express server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `CLIENT_URL` | Frontend origin for CORS | `http://localhost:5173` |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor | `12` |

---

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login + get tokens | No |
| POST | `/api/auth/refresh` | Refresh access token | Cookie |
| POST | `/api/auth/logout` | Revoke refresh token | Yes |
| GET | `/api/auth/me` | Get current user | Yes |
| PATCH | `/api/auth/me/password` | Change own password | Yes |

### Records
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/records` | Create record | Yes |
| GET | `/api/records` | List + search + paginate | Yes |
| GET | `/api/records/export` | Export as CSV | Yes |
| GET | `/api/records/:id` | Get single record | Yes |
| PUT | `/api/records/:id` | Update record | Yes |
| DELETE | `/api/records/:id` | Delete record | Yes |
| DELETE | `/api/records/bulk` | Bulk delete | Yes |

**Search params:** `?record_id=&type=income|expense&category=&date_from=&date_to=&page=1&limit=10`

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/summary` | Total income, expense, balance |
| GET | `/api/analytics/trends` | Monthly income vs expense |
| GET | `/api/analytics/categories` | Spending by category |
| GET | `/api/analytics/daily` | Daily running balance |

### AI
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/plan` | Generate budget plan |
| POST | `/api/ai/advise` | Purchase affordability check |
| POST | `/api/ai/analyze` | Free-form financial analysis |

---

## Folder Structure

```
income-expense-system/
├── .cursorrules                   ← AI coding rules
├── .gitignore
├── README.md
├── DEVELOPMENT_LOG.md
│
├── client/                        ← VIEW LAYER (React)
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── RecordsPage.jsx
│       │   └── AiAssistantPage.jsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.jsx
│       │   │   ├── Sidebar.jsx
│       │   │   └── ProtectedRoute.jsx
│       │   ├── records/
│       │   │   ├── RecordTable.jsx
│       │   │   ├── RecordForm.jsx
│       │   │   ├── SearchBar.jsx
│       │   │   └── Pagination.jsx
│       │   ├── dashboard/
│       │   │   ├── SummaryCards.jsx
│       │   │   ├── IncomeExpenseLineChart.jsx
│       │   │   ├── CategoryPieChart.jsx
│       │   │   └── RecentRecordsTable.jsx
│       │   └── ai/
│       │       ├── ExpensePlanner.jsx
│       │       ├── PurchaseAdvisor.jsx
│       │       └── AnalysisChat.jsx
│       ├── context/
│       │   └── auth_context.jsx
│       ├── services/
│       │   └── api.js
│       └── App.jsx
│
└── server/                        ← BACKEND (Express MVC)
    ├── prisma/
    │   └── schema.prisma
    └── src/
        ├── controllers/           ← CONTROLLER LAYER
        │   ├── auth_controller.js
        │   ├── record_controller.js
        │   ├── analytics_controller.js
        │   └── ai_controller.js
        ├── services/              ← BUSINESS LOGIC LAYER
        │   ├── auth_service.js
        │   ├── record_service.js
        │   ├── analytics_service.js
        │   └── ai_service.js
        ├── models/                ← DATA MODEL LAYER
        │   ├── user_model.js
        │   ├── record_model.js
        │   └── refresh_token_model.js
        ├── routes/
        │   ├── auth_routes.js
        │   ├── record_routes.js
        │   ├── analytics_routes.js
        │   └── ai_routes.js
        ├── middleware/
        │   ├── auth_middleware.js
        │   ├── error_handler.js
        │   ├── rate_limiter.js
        │   └── sanitize.js
        ├── config/
        │   ├── database.js
        │   └── jwt_config.js
        └── app.js
```

---

## Database Schema

```sql
-- Generated by: npx prisma migrate dev
-- Full SQL available in: server/prisma/migrations/

TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,           -- bcrypt hashed
  role          TEXT DEFAULT 'USER',
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP
);

TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,      -- bcrypt hashed
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  revoked_at  TIMESTAMP,
  user_agent  TEXT,
  ip_address  TEXT
);

TABLE records (
  id          TEXT PRIMARY KEY,          -- user-defined, unique
  type        TEXT CHECK (type IN ('income','expense')),
  amount      NUMERIC(15,2) NOT NULL,
  category    TEXT NOT NULL,
  date        DATE NOT NULL,
  operator    TEXT NOT NULL,
  notes       TEXT,
  user_id     TEXT REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP,
  INDEX ON (type),
  INDEX ON (category),
  INDEX ON (date)
);
```

---

## Deliverables (Instructor Checklist)

- ✅ Source code — MVC structure (controllers/ services/ models/)
- ✅ Database schema — `docs/schema.sql`
- ✅ API documentation — `docs/API_Documentation.md`
- ✅ User manual — `docs/User_Manual.md`

---

## Author

Student Name — University Course — Year