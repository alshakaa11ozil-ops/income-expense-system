/*
  Warnings:

  - Made the column `category_id` on table `Record` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "BudgetGoal" DROP CONSTRAINT "BudgetGoal_user_id_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "Record" ALTER COLUMN "category_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Category_user_id_idx" ON "Category"("user_id");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetGoal" ADD CONSTRAINT "BudgetGoal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "BudgetGoal_user_category_month_year_key" RENAME TO "BudgetGoal_user_id_category_id_month_year_key";

-- RenameIndex
ALTER INDEX "BudgetGoal_user_month_year_idx" RENAME TO "BudgetGoal_user_id_month_year_idx";
