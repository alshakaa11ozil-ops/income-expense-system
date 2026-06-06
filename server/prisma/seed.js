/*
 * ============================================================
 * FILE    : seed.js
 * LAYER   : Database / Seed
 * PURPOSE : Populate the database with an admin user, a test
 *           user, 27 system categories, and 15 sample records
 *           so the application has meaningful data immediately
 *           after a fresh migrate reset.
 * DEPENDS : @prisma/client, bcrypt
 * ============================================================
 * EXPORTS:
 *   - (none) — executed directly by `prisma db seed`
 * ============================================================
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // Using bcryptjs as per package.json

const prisma = new PrismaClient();

/* ──────────────────────────────────────────────────────────
 * SEED CONSTANTS
 * ────────────────────────────────────────────────────────── */
const SALT_ROUNDS      = 12;
const ADMIN_ID         = 'admin_seed_001';
const TEST_USER_ID     = 'user_seed_001';
const ADMIN_EMAIL      = 'admin@example.com';
const TEST_USER_EMAIL  = 'testuser@example.com';
const DEFAULT_PASSWORD = 'Password123!';

/* ──────────────────────────────────────────────────────────
 * CATEGORY DEFINITIONS — 27 system categories
 * user_id = null  →  visible to ALL users
 * created_by = ADMIN_ID  →  seeded by admin
 * ────────────────────────────────────────────────────────── */
const SYSTEM_CATEGORIES = [
  // ── Income ──────────────────────────────────────────────
  { name: 'Salary',        icon: '💰', color: '#10B981', display_order: 1  },
  { name: 'Freelance',     icon: '💻', color: '#06B6D4', display_order: 2  },
  { name: 'Business',      icon: '🏢', color: '#3B82F6', display_order: 3  },
  { name: 'Investment',    icon: '📈', color: '#8B5CF6', display_order: 4  },
  { name: 'Gift',          icon: '🎁', color: '#F59E0B', display_order: 5  },
  { name: 'Other Income',  icon: '💵', color: '#6B7280', display_order: 6  },

  // ── Housing & Bills ─────────────────────────────────────
  { name: 'Rent',          icon: '🏠', color: '#3B82F6', display_order: 7  },
  { name: 'Electricity',   icon: '⚡', color: '#EAB308', display_order: 8  },
  { name: 'Water',         icon: '💧', color: '#0EA5E9', display_order: 9  },
  { name: 'Internet',      icon: '📡', color: '#6366F1', display_order: 10 },
  { name: 'Phone Bill',    icon: '📱', color: '#8B5CF6', display_order: 11 },

  // ── Daily Living ─────────────────────────────────────────
  { name: 'Groceries',     icon: '🛒', color: '#22C55E', display_order: 12 },
  { name: 'Dining Out',    icon: '🍔', color: '#F97316', display_order: 13 },
  { name: 'Coffee',        icon: '☕', color: '#92400E', display_order: 14 },
  { name: 'Transport',     icon: '🚌', color: '#6366F1', display_order: 15 },
  { name: 'Fuel',          icon: '⛽', color: '#DC2626', display_order: 16 },

  // ── Personal ─────────────────────────────────────────────
  { name: 'Healthcare',    icon: '🏥', color: '#EF4444', display_order: 17 },
  { name: 'Clothing',      icon: '👕', color: '#EC4899', display_order: 18 },
  { name: 'Personal Care', icon: '🧴', color: '#F9A8D4', display_order: 19 },
  { name: 'Education',     icon: '📚', color: '#2563EB', display_order: 20 },
  { name: 'Subscriptions', icon: '📺', color: '#7C3AED', display_order: 21 },

  // ── Leisure ──────────────────────────────────────────────
  { name: 'Entertainment', icon: '🎬', color: '#A855F7', display_order: 22 },
  { name: 'Travel',        icon: '✈️', color: '#0284C7', display_order: 23 },
  { name: 'Sports',        icon: '🏋️', color: '#16A34A', display_order: 24 },
  { name: 'Shopping',      icon: '🛍️', color: '#DB2777', display_order: 25 },

  // ── Financial ────────────────────────────────────────────
  { name: 'Savings',       icon: '🏦', color: '#0F766E', display_order: 26 },
  { name: 'Insurance',     icon: '🛡️', color: '#1D4ED8', display_order: 27 },
  { name: 'Tax',           icon: '📋', color: '#374151', display_order: 28 },
  { name: 'Other Expense', icon: '📁', color: '#9CA3AF', display_order: 29 },
];

/* ──────────────────────────────────────────────────────────
 * SEED RECORDS — 15 sample records for the test user
 * category_id values mapped to new 27-category system above
 * ────────────────────────────────────────────────────────── */
const SEED_RECORDS = [
  {
    id:          'REC-20260501-0001',
    type:        'income',
    amount:      '5000.00',
    category_name: 'Salary',
    date:        new Date('2026-05-01'),
    operator:    'John Doe',
    notes:       'May salary',
  },
  {
    id:          'REC-20260502-0001',
    type:        'expense',
    amount:      '1200.00',
    category_name: 'Rent',
    date:        new Date('2026-05-02'),
    operator:    'John Doe',
    notes:       'Monthly rent',
  },
  {
    id:          'REC-20260503-0001',
    type:        'expense',
    amount:      '350.00',
    category_name: 'Groceries',
    date:        new Date('2026-05-03'),
    operator:    'John Doe',
    notes:       'Weekly grocery run',
  },
  {
    id:          'REC-20260505-0001',
    type:        'expense',
    amount:      '85.00',
    category_name: 'Electricity',
    date:        new Date('2026-05-05'),
    operator:    'John Doe',
    notes:       'April electricity bill',
  },
  {
    id:          'REC-20260506-0001',
    type:        'expense',
    amount:      '45.00',
    category_name: 'Internet',
    date:        new Date('2026-05-06'),
    operator:    'John Doe',
    notes:       'Monthly broadband',
  },
  {
    id:          'REC-20260508-0001',
    type:        'expense',
    amount:      '120.00',
    category_name: 'Transport',
    date:        new Date('2026-05-08'),
    operator:    'John Doe',
    notes:       'Monthly transit pass',
  },
  {
    id:          'REC-20260510-0001',
    type:        'income',
    amount:      '800.00',
    category_name: 'Freelance',
    date:        new Date('2026-05-10'),
    operator:    'John Doe',
    notes:       'Logo design project',
  },
  {
    id:          'REC-20260512-0001',
    type:        'expense',
    amount:      '60.00',
    category_name: 'Dining Out',
    date:        new Date('2026-05-12'),
    operator:    'John Doe',
    notes:       'Dinner with friends',
  },
  {
    id:          'REC-20260514-0001',
    type:        'expense',
    amount:      '25.00',
    category_name: 'Subscriptions',
    date:        new Date('2026-05-14'),
    operator:    'John Doe',
    notes:       'Streaming services',
  },
  {
    id:          'REC-20260515-0001',
    type:        'expense',
    amount:      '200.00',
    category_name: 'Healthcare',
    date:        new Date('2026-05-15'),
    operator:    'John Doe',
    notes:       'Dental check-up',
  },
  {
    id:          'REC-20260518-0001',
    type:        'expense',
    amount:      '150.00',
    category_name: 'Clothing',
    date:        new Date('2026-05-18'),
    operator:    'John Doe',
    notes:       'Spring jacket',
  },
  {
    id:          'REC-20260520-0001',
    type:        'expense',
    amount:      '90.00',
    category_name: 'Entertainment',
    date:        new Date('2026-05-20'),
    operator:    'John Doe',
    notes:       'Concert tickets',
  },
  {
    id:          'REC-20260522-0001',
    type:        'income',
    amount:      '250.00',
    category_name: 'Investment',
    date:        new Date('2026-05-22'),
    operator:    'John Doe',
    notes:       'Dividend payout',
  },
  {
    id:          'REC-20260525-0001',
    type:        'expense',
    amount:      '500.00',
    category_name: 'Savings',
    date:        new Date('2026-05-25'),
    operator:    'John Doe',
    notes:       'Transfer to savings account',
  },
  {
    id:          'REC-20260528-0001',
    type:        'expense',
    amount:      '75.00',
    category_name: 'Fuel',
    date:        new Date('2026-05-28'),
    operator:    'John Doe',
    notes:       'Petrol refill',
  },
];

/* ──────────────────────────────────────────────────────────
 * MAIN SEED FUNCTION
 * ────────────────────────────────────────────────────────── */

/*
 * FUNCTION : main
 * ─────────────────────────────────────────────────────────
 * WHY      : Orchestrates the full database seed in a safe,
 *            idempotent order. Uses upsert so re-running the
 *            seed never throws duplicate-key errors.
 *
 * HOW      : 1. Hash the shared password once (bcrypt, 12 rounds)
 *            2. Upsert admin user with ADMIN role
 *            3. Upsert test user with USER role
 *            4. Upsert 27 system categories (user_id = null)
 *            5. Upsert 15 sample records for the test user
 *            6. Disconnect prisma client
 *
 * @returns {void}
 * @throws  {Error} — rethrows any Prisma or bcrypt error after
 *                    logging, so `prisma db seed` exits non-zero
 * ─────────────────────────────────────────────────────────
 */
async function main() {
  console.log('🌱  Seeding database...');

  // ── 1. Hash the shared default password once ────────────
  const hashed_password = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  console.log('   ✓ Password hashed');

  // ── 2. Admin user ────────────────────────────────────────
  await prisma.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: {},
    create: {
      id:             ADMIN_ID,
      username:       'admin',
      email:          ADMIN_EMAIL,
      password:       hashed_password,
      role:           'ADMIN',
      is_active:      true,
      ai_daily_limit: 50,
    },
  });
  console.log(`   ✓ Admin user — ${ADMIN_EMAIL}`);

  // ── 3. Test user ─────────────────────────────────────────
  await prisma.user.upsert({
    where:  { email: TEST_USER_EMAIL },
    update: {},
    create: {
      id:             TEST_USER_ID,
      username:       'testuser_seed',
      email:          TEST_USER_EMAIL,
      password:       hashed_password,
      role:           'USER',
      is_active:      true,
      ai_daily_limit: 10,
    },
  });
  console.log(`   ✓ Test user  — ${TEST_USER_EMAIL}`);

  // ── 4. 27 system categories ──────────────────────────────
  // user_id = null makes these visible to every user.
  // created_by records who added them in this seed run.
  let category_count = 0;
  const name_to_id = {};

  for (const cat of SYSTEM_CATEGORIES) {
    const seeded = await prisma.category.upsert({
      where:  { name: cat.name },
      update: {
        icon:          cat.icon,
        color:         cat.color,
        is_active:     true,
      },
      create: {
        name:          cat.name,
        icon:          cat.icon,
        color:         cat.color,
        is_active:     true,
        user_id:       null,          // system-wide — no owner
        created_by:    ADMIN_ID,
      },
    });
    name_to_id[cat.name] = seeded.id;
    category_count++;
  }
  console.log(`   ✓ ${category_count} system categories seeded`);

  // ── 5. Sample records for the test user ──────────────────
  let record_count = 0;
  for (const rec of SEED_RECORDS) {
    const category_id = name_to_id[rec.category_name];
    if (!category_id) {
      console.warn(`   ⚠️  Category not found for record: ${rec.id} (${rec.category_name})`);
      continue;
    }

    await prisma.record.upsert({
      where:  { id: rec.id },
      update: {},
      create: {
        id:          rec.id,
        type:        rec.type,
        amount:      rec.amount,
        category_id: category_id,
        date:        rec.date,
        operator:    rec.operator,
        notes:       rec.notes ?? null,
        user_id:     TEST_USER_ID,
        deleted_at:  null,
        deleted_by:  null,
      },
    });
    record_count++;
  }
  console.log(`   ✓ ${record_count} sample records seeded for testuser`);

  console.log('\n🌱  Seed complete!');
  console.log('   Admin   : admin@example.com / Password123!');
  console.log('   TestUser: testuser@example.com / Password123!');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });