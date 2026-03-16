# Receipt feature – agreed scope

So we’re aligned before implementing (Emulator → SDK → EPOS).

---

## What we mean by “receipt”

A **receipt** is the **customer-facing record of a completed transaction** (sale or refund). It’s a document the merchant can show or print for the customer after a successful (or completed) payment.

- **In scope for this feature:**  
  - Requesting the **text content** of the receipt for a **specific transaction** (by `txn_id`).  
  - The **device** (emulator) holds or generates that content; the EPOS asks for it and displays or shares it.

- **Out of scope for this iteration:**  
  - Physical receipt **printing** (printer hardware / driver).  
  - **Reprint last receipt** (no “last” on device; EPOS can call getReceiptData again with the same `txn_id`).  
  - **Email/SMS** receipt (we only define and deliver the content; how the app sends it is up to the app).  
  - Receipt **templates** or **branding** on the device (emulator can return a simple fixed format).

---

## Data we already have (SDK)

The SDK already defines **ReceiptData**:

| Field           | Meaning |
|----------------|--------|
| `transactionId`| Transaction ID (e.g. from the sale/refund result). |
| `requestId`    | Optional request ID that led to this transaction. |
| `content`      | **Receipt body** – plain text (or HTML) the app can show, print, or share. |
| `format`       | `plain` or `html`. We can start with **plain** only. |
| `timestampUtc` | When the receipt was generated (ISO8601). |

So “receipt” in code = **one `ReceiptData` value** per transaction: same `transactionId` as the result, and `content` being the actual receipt text.

---

## Flow (end to end)

1. **After a completed sale or refund**  
   - The device (emulator) already has a `txn_id` and can associate a receipt with it.  
   - The result may include something like `receipt_available: true` (we can add that when we add receipts).

2. **EPOS wants to show/print the receipt**  
   - EPOS calls SDK: `getReceiptData(transactionId: txnId)`.  
   - SDK sends a **GetReceipt** (or equivalent) command to the device with that `txn_id`.

3. **Device**  
   - Looks up the transaction (by `txn_id`) and returns the receipt **content** (and optional metadata).  
   - If the device doesn’t support receipts or doesn’t have that transaction, it returns an error (SDK surfaces as throw / unsupported).

4. **SDK**  
   - Maps the device response to **ReceiptData** (transactionId, requestId if available, content, format, timestampUtc) and returns it to the app.

5. **EPOS**  
   - Displays the receipt (e.g. in a sheet or new screen), and optionally offers **Share** / **Print** using the system share sheet or print UI, using `content` only. No device-specific print API in this scope.

---

## What “receipt content” is (plain text)

For the **emulator**, we can define a **simple fixed format** so we have something real to implement and test, for example:

- Header: e.g. “PATH POS – RECEIPT”
- Transaction type: SALE or REFUND
- Date/time (from the transaction)
- Amount, currency
- Card last four (if we have it)
- Transaction ID (short form)
- Optional footer line

Exact layout (line breaks, labels) can be agreed when we implement the emulator command. The important part is: **content** is a single string (plain text for v1), and the EPOS only displays or passes it to system print/share.

---

## Summary

| Term | Meaning |
|------|--------|
| **Receipt** | Customer-facing record of one completed transaction (sale or refund). |
| **Receipt content** | One string (plain text in v1) that the app can show, print, or share. |
| **getReceiptData(transactionId)** | “Give me the receipt text for this transaction.” Device returns content (or error). |
| **EPOS receipt UX** | Show content in-app; offer Share/Print using that string only. |

When we implement, we’ll add: **Emulator** (GetReceipt by `txn_id` → return plain-text content), **SDK** (implement `getReceiptData` in BLE adapter), **EPOS** (button “Receipt” after a completed txn → call SDK → show + share/print). We’ll revisit the rest of the feature list after this is done.
