# User Manual
## Income/Expense Management System

---

## 1. Getting Started

### Register
1. Open the app and click **Get Started** or navigate to `/register`
2. Enter a username (min 3 characters), a valid email, and a password (min 8 characters)
3. Click **Create Account**
4. You will be redirected to the Login page

### Login
1. Enter your email and password
2. Click **Sign In**
3. You will be taken to the **Dashboard**

---

## 2. Records — Teacher-Graded Core Features

### Adding a Record (Q13 Requirement: Add)
1. Go to the **Records** page from the sidebar
2. Click **+ Add Record**
3. Fill in the mandatory fields:
   - **Record ID** — auto-generated, but you can type your own
   - **Type** — Income or Expense
   - **Amount** — positive number (e.g. `1500.00`)
   - **Category** — pick from the dropdown
   - **Date** — the transaction date
   - **Operator** — person responsible for the transaction
4. Optionally add **Notes**
5. Click **Save**

> **Duplicate ID Error:** If the Record ID already exists in the system, an error message appears under the ID field: *"This Record ID is already taken."* Choose a different ID and try again.

---

### Editing a Record (Q13 Requirement: Edit with Fixed ID)
1. On the Records page, click the **✏️ pencil icon** on any row
2. The edit form opens with all current values filled in
3. **The Record ID field is locked and cannot be changed** — it shows a "Fixed" badge
4. Edit any other field: type, amount, category, date, operator, notes
5. Click **Save Changes**

> **Why is the ID locked?** Once a record is saved, its ID is permanent. This preserves data integrity — other systems or notes that reference this ID remain valid.

---

### Deleting a Record (Q13 Requirement: Delete from list)
1. On the Records page, click the **🗑️ trash icon** on any row
2. A confirmation dialog appears: *"Are you sure you want to delete this record?"*
3. Click **Delete** to confirm
4. The record is removed from your list instantly

> Records are **soft-deleted** — admins can restore them from the Admin Panel if needed.

---

### Searching and Filtering (Q13 Requirement: Search with Server-Side Pagination)
The Records page supports real-time server-side filtering:

| Filter | How to Use |
|--------|-----------|
| **Record ID** | Type in the search box to filter by a specific ID |
| **Type** | Use the dropdown to show only `income` or `expense` |
| **Category** | Pick a category from the dropdown |
| **Date Range** | Enter Start Date / End Date, or click quick buttons: **This Month**, **Past 3 Months**, **Past 6 Months** |

- Results and the **total count** update immediately when filters change
- Navigation: **Previous / Next** page buttons
- **10 records per page** by default
- The URL updates to reflect current filters (e.g. `?type=income&page=2`) — server-side only, no client-side JS filtering

---

### Bulk Delete
1. Check the checkbox at the top to select all — or check individual rows
2. Click **Delete Selected**
3. Confirm the dialog

---

### Export to CSV
1. Apply any filters you want (or leave blank for all records)
2. Click **Export CSV**
3. A file downloads containing all matching records

---

## 3. Categories

### System Categories
- 27 built-in categories (Food, Transport, Salary, etc.) are available to all users
- These are managed by admins and cannot be deleted by regular users

### Personal Categories
1. Go to **My Categories** from the sidebar
2. Click **+ New Category**
3. Enter a name, pick an icon emoji and a color
4. Optionally set a **Monthly Spending Limit** — this enables progress bars on the dashboard
5. Click **Save**

To edit or delete a personal category, use the **✏️** and **🗑️** icons next to each category.

> **Note:** A category that has records attached to it cannot be deleted (you will see a 409 Conflict error). Remove or reassign the records first.

---

## 4. Dashboard

The Dashboard gives you a financial overview for the **current month**:

| Section | Description |
|---------|-------------|
| **Total Income** | Sum of all income records this month |
| **Total Expense** | Sum of all expense records this month |
| **Net Balance** | Income minus Expenses |
| **Line Chart** | Income vs. Expense trend over the last 6 months |
| **Pie Chart** | Expense breakdown by category |
| **Recent Transactions** | Your last 5 records with a **View All** link |

---

## 5. AI Assistant

> **Daily Limit:** 10 requests per day (USER role). Cached responses are **free** and do not count toward your limit.

Navigate to **AI Assistant** from the sidebar. Three tabs are available:

### Tab 1 — Budget Planner
1. Enter a **target monthly budget** (e.g. `3000`)
2. Select the **month** and **year**
3. Click **Generate Plan**
4. The AI suggests an allocation per category with reasoning
5. Click **Save as Goals** to persist them as budget goals

### Tab 2 — Purchase Advisor
1. Enter the **item name** (e.g. `MacBook Pro`)
2. Enter the **cost** and **planned purchase date**
3. Click **Check Affordability**
4. The AI returns one of three verdicts: **Can Afford**, **Wait**, or **Adjust Spending**, along with a detailed explanation

### Tab 3 — Finance Chat
1. Type any financial question about your own data (e.g. *"What is my biggest expense category this year?"*)
2. Click **Ask**
3. The AI answers using your actual records and spending history

---

## 6. My Profile

Navigate to **My Profile** by clicking your username in the bottom of the sidebar.

### Viewing Account Info
- Username, email, role badge (USER / ADMIN), and daily AI limit are shown

### Viewing AI Usage
- Today's usage count and remaining requests are displayed with a color-coded progress bar
- Green = under 50% used, Amber = 50–90%, Red = over 90%

### Changing Your Password
1. Scroll to the **Change Password** section
2. Enter your **Current Password**
3. Enter a **New Password** (min 8 characters)
4. Re-enter the new password in **Confirm New Password**
5. Click **Update Password**

> If your current password is wrong, an error appears under that field without clearing the form.

### Sign Out
Click the **Sign Out** button in the Danger Zone at the bottom of the profile page. You will be redirected to the Login page.

---

## 7. Admin Panel (ADMIN role only)

Navigate to **Admin Panel** from the sidebar (visible to ADMIN accounts only).

### Users Tab
| Action | How |
|--------|-----|
| View all users | See a paginated list with role, status, last login |
| Activate / Deactivate | Click the toggle switch next to a user |
| Change Role | Click the role badge to promote to ADMIN or demote to USER |
| Add Note | Click the note icon to leave an admin note on a user account |

### Audit Tab
- Search for any user and view **all** their records including soft-deleted ones
- **Restore** button to undelete a soft-deleted record
- **Hard Delete** button to permanently remove a record from the database (irreversible)

### Analytics Tab
- Platform-wide income, expense, and balance totals
- Number of active users, total records, and growth metrics

### AI Usage Tab
- View AI usage logs across all users for the past N days

### Categories Tab
- View, create, update, and deactivate **system categories** that are shared with all users

---

## 8. Troubleshooting

| Problem | Solution |
|---------|---------|
| "Record ID already exists" | The ID you typed is taken — choose a different one or let the system auto-generate |
| Record ID field is disabled when editing | Correct — the ID is permanently locked after creation |
| Session expired / logged out | Your session timed out. Log in again |
| "AI limit reached" | You've used all 10 daily requests. Limit resets at midnight |
| Charts show no data | Add some records first — the dashboard needs data to display |
| "Current password incorrect" | Re-enter your existing password exactly as it was set |
| Category cannot be deleted (409) | The category is used by existing records — reassign or delete those records first |
| Admin panel shows 403 | Your account does not have the ADMIN role |
