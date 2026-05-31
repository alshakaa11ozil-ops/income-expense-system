-- ============================================================
-- MIGRATION : 20260528_004_add_categories
-- PURPOSE   : Add Category table for admin-managed categories.
--             Converts Record.category from a plain text field
--             to a proper FK relationship.
-- SAFE      : Requires data migration if records already exist.
--             In development: run `prisma migrate reset` instead.
-- ============================================================

-- Step 1: Create the Category table
CREATE TABLE "Category" (
    "id"         TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "icon"       TEXT         NOT NULL DEFAULT '📁',
    "color"      TEXT         NOT NULL DEFAULT '#6B7280',
    "is_active"  BOOLEAN      NOT NULL DEFAULT TRUE,
    "created_by" TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_key"      ON "Category"("name");
CREATE INDEX        "Category_name_idx"      ON "Category"("name");
CREATE INDEX        "Category_is_active_idx" ON "Category"("is_active");


-- Step 2: Add category_id column to Record (nullable first for safety)
ALTER TABLE "Record"
    DROP COLUMN "category",
    ADD COLUMN  "category_id" TEXT;


-- Step 3: Seed default categories so existing records can be linked
-- NOTE: In a fresh dev environment, uncomment these and run manually BEFORE
--       making category_id NOT NULL in Step 5.
--
-- INSERT INTO "Category" (id, name, icon, color, created_by, updated_at)
-- VALUES
--     ('cat_salary',    'Salary',    '💰', '#10B981', 'admin_seed_001', NOW()),
--     ('cat_food',      'Food',      '🍔', '#F59E0B', 'admin_seed_001', NOW()),
--     ('cat_rent',      'Rent',      '🏠', '#3B82F6', 'admin_seed_001', NOW()),
--     ('cat_transport', 'Transport', '🚌', '#8B5CF6', 'admin_seed_001', NOW()),
--     ('cat_utilities', 'Utilities', '⚡', '#EF4444', 'admin_seed_001', NOW()),
--     ('cat_shopping',  'Shopping',  '🛍️', '#EC4899', 'admin_seed_001', NOW()),
--     ('cat_freelance', 'Freelance', '💻', '#06B6D4', 'admin_seed_001', NOW()),
--     ('cat_other',     'Other',     '📁', '#6B7280', 'admin_seed_001', NOW());


-- Step 4: Add FK constraint (after data migration / seed if needed)
ALTER TABLE "Record"
    ADD CONSTRAINT "Record_category_id_fkey"
    FOREIGN KEY ("category_id")
    REFERENCES "Category"("id")
    ON DELETE RESTRICT   -- cannot delete a category that has records
    ON UPDATE CASCADE;

CREATE INDEX "Record_category_id_idx" ON "Record"("category_id");


-- Step 5: Make category_id NOT NULL after backfill
-- Uncomment and run this ONLY after every existing Record row has a category_id:
-- ALTER TABLE "Record" ALTER COLUMN "category_id" SET NOT NULL;
