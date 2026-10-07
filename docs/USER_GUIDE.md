# ConsignPro — User Guide

A guide for store staff (owners, managers, and employees) using the ConsignPro
consignment platform day to day.

> **Your store address:** your platform lives at your own web address
> (e.g. `https://your-store.up.railway.app`). Replace "your site" below with it.

---

## 1. Signing in

1. Go to **your site** → you'll land on the **Sign in** page.
2. Enter your **email** and **password** → **Sign In**.
3. You'll arrive at the **Point of Sale** screen.

Forgot your password? Ask your store owner/admin — they can reset it (see the
Admin Guide → "Resetting a password").

**Dark / light mode:** at the bottom of the left sidebar, use **Dark mode /
Light mode** to switch themes. Your choice is remembered on that device.

---

## 2. Point of Sale (POS)

The POS is where you ring up sales.

### Ringing up a sale
1. **Find items** — type a name or SKU in the search box, or **scan a barcode**.
   - **Scanning:** just scan the item's label — it's **added straight to the
     cart** and you'll see a green "Added: …" confirmation. Scan the next item,
     and so on.
   - **Typing a name:** results appear below; click one to add it to the cart.
2. **Review the cart** on the right — remove a line with the trash icon.
3. **Discount (optional):** type a dollar amount in the Discount box.
4. **Loyalty points (optional):**
   - In the **Loyalty Points** box, type the customer's **email** → **Find**.
   - Their available points show. Enter how many points to **redeem**
     (100 points = $1). The discount is applied automatically.
5. **Choose payment:** **Card** (Clover) or **Cash**.
6. Click **Charge $X.XX**.
7. A **receipt** pops up — **Print Receipt** or Close. Points are awarded to the
   customer automatically (1 point per $1 spent) when a customer is attached.

### Notes
- Only **Active** items can be sold. Sold/returned items won't scan into a sale.
- Card payments create an order in your Clover account; the actual card charge
  happens on your Clover device/terminal.

---

## 3. Inventory

Manage every item in the store. Open **Inventory** from the sidebar.

### Views & sorting
- Top-right, switch between **List**, **Cards**, and **Compact** views.
- In **List** view, click any column header (Item, Brand, Consignor, Price,
  Added) to sort; click again to reverse.
- **Status tabs** (Active / Sold / Returned / Expired) filter what you see.
- **Search** by title, brand, SKU, or consignor name.

### The scan box
At the top there's a **Scan** box. Scan a barcode or SKU (or type it and press
Enter) and that item **opens for editing** immediately — handy for quick price
checks or edits at the counter.

### Adding an item
1. **Inventory → Add Item**.
2. Fill in the details: title, brand, size, condition, price, consignor, category.
3. **AI Item Entry (optional):** drop a photo and the assistant fills in the
   title, brand, category, condition, size, color, description, and a suggested
   price for you to review.
4. **Photos:** drag-and-drop photos; the first is the main image.
5. **Custom SKU (optional):** type your own SKU (e.g. `CC-DRESS-001`) or leave
   it blank to auto-generate.
6. **Barcode:** scan a barcode into this field (or leave blank to use the SKU).
7. **List on public online shop:** toggle on to show the item at your `/shop`.
8. **Save** → you'll get the SKU and a **Print Label** button.

### Editing an item
Click any item (row or card) to open the **Edit** window. You can change the
title, SKU, barcode, brand, size, condition, **price**, **cost** (what it cost
you), **location** (In-store / Storage), status, and online listing, **Print
Label**, or **Delete** (deletion is blocked for items with sales). Items can
also be edited from a consignor's **Items** tab (Edit pencil on each row).

### Bulk actions
Select items with the checkboxes (or "select all"), then use the blue bar:
- **Print labels** — prints a scannable label for every selected item.
- **Markdown %** — reduce the price of all selected items by a percentage.
- **List online / Unlist** — show/hide on the public shop in bulk.
- **Mark Returned** — change status in bulk.
- **Delete** — remove selected items (sold items can't be deleted).

### Labels
Printed labels are **2" × 1"** and carry a **scannable Code128 barcode** (the
item's barcode, or its SKU), the code, and the price. Print from the Add-Item
screen, the Edit window, or the bulk **Print labels** action.

### Aging alerts
On the Active tab, items expiring within 14 days are flagged at the top so you
can mark them down or return them.

---

## 4. Consignors

The people who bring you items to sell. Open **Consignors** from the sidebar.

- **Views / sorting / search / multi-select** work the same as Inventory.
- **Add** a consignor with the **Add** button (name, contact, split %).
- **Click a consignor** to edit their name, contact, **split %**, and **portal
  access**, or open **Details** for their full items / earnings / payout history.
- **Bulk actions:** set split %, enable/disable portal access, delete.
- **Balance** is what you currently owe each consignor. It goes up whenever one
  of their items **sells** — either through the POS or by **marking an item
  SOLD** from the Edit window. Once a consignor's balance is above $0 they appear
  on the **Payouts** page. (Changing a sold item back to Active reverses the
  credit.)
- When adding or editing a consignor you can set their **preferred payout
  method** (Check/Cash/Zelle/Cash App/ACH) with the matching details, and an
  **"If items don't sell"** preference: **Pick-up**, **Donate**, or **Continue
  consigning (30 days)**.

### Consignor detail page
Shows KPI cards (balance, earned, active, sold), and tabs for **Items**,
**Ledger** (every credit/debit), and **Payouts**. You can **issue a payout**
here (Check / Cash / ACH).

- **Notes:** there's a **Notes** box on each consignor's page — type anything
  you want to remember (preferences, reminders, special arrangements) and
  **Save notes**. It's kept with the consignor.
- **Item notes:** open an item's **Edit** window (pencil on the Items tab) and
  use the **Note** field to jot anything specific to that item. Saved with the item.

---

## 5. Customers

Your loyalty members. Open **Customers** from the sidebar.

- **Views / sorting / search / multi-select** as above.
- **Add** a customer (name, email, phone).
- **Click a customer** to edit name, email, phone, and **loyalty points**, or
  delete them.
- **Bulk actions:** add points to many at once, or delete.
- Customers earn **1 point per $1** spent (when attached to a sale) and redeem
  **100 points = $1** at the POS.

---

## 6. Payouts

Pay your consignors. Open **Payouts** from the sidebar.

- **Pending Balances** tab lists consignors who are owed money.
- Select who to pay, choose the **method** (Check, Cash, **Zelle**, **Cash App**,
  or ACH), and process — checks are numbered sequentially.
- For **Zelle / Cash App / Check**, you'll be asked for the destination (their
  Zelle phone/email, Cash App $Cashtag, or mailing address). It's saved on the
  consignor, so next time it's pre-filled. Batch payouts use each consignor's
  saved details automatically.
- **Sync sold items** (top-right of the Payouts page) credits consignors for any
  items already marked **SOLD** that aren't yet showing a balance — for example,
  sales brought in through a data import. Normally selling an item (via the POS
  or by marking it SOLD) credits the consignor automatically; use this button
  once after an import, or any time a sold item isn't reflected on a balance.
- **Payout History** tab shows everything you've paid.
- You can **edit a past payout** (amount, method, destination, status, note) from
  the **Payouts** tab on a consignor's page — changing the amount automatically
  re-adjusts their balance and ledger.
- Consignors with portal access can also **request a payout** themselves; those
  requests appear as pending payouts for you to process.

---

## 7. Contracts

Consignment agreements with e-signature. Open **Contracts** from the sidebar.

1. **New Contract** → pick a consignor → optionally **send the signing link by
   email**.
2. The consignor opens the link, reads the agreement, **signs on screen**, and
   submits. Their signature, IP, and timestamp are recorded.
3. The contract's status moves **Draft → Sent → Signed**.
4. Click the eye icon to view a contract (and its signature).

The agreement text is your store's standard template; the owner can edit it in
**Settings → Contract Template**.

---

## 8. Store Insights & Reports

- **Store Insights** — charts for 30-day revenue, top categories, and inventory
  status.
- **Reports** — key numbers plus **CSV export** for Sales, Inventory,
  Consignors, and Ledger (with optional date range). Great for bookkeeping.

---

## 9. Online shop

Your public storefront is at **your site `/shop`** — no login needed; this is
what customers see. Any item marked **"List on public online shop"** appears
there automatically. Share that link on social media or your website.

---

## 10. Consignor & Dealer portals

- **Consignor portal** (`/portal`) — consignors with portal access sign in to
  see their items, earnings, and balance, and to **request a payout**.
- **Dealer entry** (`/dealer`) — lets approved dealers submit multiple items at
  once for your review.

---

## 11. Importing existing data

Owners/managers can bulk-load data at **your site `/import`** by uploading a
prepared file:
- A **consignors + inventory** file, or
- A **customers** file.

The page shows a preview (counts) before you confirm. Records are matched by
email so nothing is duplicated. (Preparing these files from spreadsheets is
done with help from your admin.)

---

## Quick tips
- **Scanning works anywhere there's a field** — the scanner just "types" the
  code and presses Enter.
- **Switch views** (List / Cards / Compact) to suit the task — Compact is great
  for scanning long lists; Cards are nice for browsing with photos.
- **Multi-select + bulk actions** save a lot of time (markdowns, labels, points).
- Use **Dark mode** for low-light counters.

_Questions about setup, accounts, payments, or integrations? See the Admin
Guide._
