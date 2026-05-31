-- MIGRATION : 20260528_005_add_budget_goals
-- PURPOSE   : Add per-user per-category monthly budget goals.
--             Powers the AI Expense Planner comparison feature.

CREATE TABLE "BudgetGoal" (
    "id"          TEXT          NOT NULL,
    "user_id"     TEXT          NOT NULL,
    "category_id" TEXT          NOT NULL,
    "amount"      DECIMAL(15,2) NOT NULL,
    "month"       INTEGER       NOT NULL,  -- 1 to 12
    "year"        INTEGER       NOT NULL,
    "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "BudgetGoal_pkey" PRIMARY KEY ("id")
);

-- One goal per category per month per user
CREATE UNIQUE INDEX "BudgetGoal_user_category_month_year_key"
    ON "BudgetGoal"("user_id", "category_id", "month", "year");

CREATE INDEX "BudgetGoal_user_id_idx"
    ON "BudgetGoal"("user_id");

CREATE INDEX "BudgetGoal_user_month_year_idx"
    ON "BudgetGoal"("user_id", "month", "year");

ALTER TABLE "BudgetGoal"
    ADD CONSTRAINT "BudgetGoal_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetGoal"
    ADD CONSTRAINT "BudgetGoal_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
