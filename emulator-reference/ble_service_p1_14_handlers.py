# Reference handlers for Path POS Emulator — P1-14 (Cancel + GetTransactionStatus)
# Merge into BLEService (ble_service.py) — adjust names to match your class.
#
# Prerequisites (from P1-10 / P1-11):
# - self.pending_result: None or dict with keys req_id, cmd, result_data, status
# - self._send_result(req_id, cmd, status, data_dict)  # your existing helper
# - Optional: self.last_result_by_req_id = {}  # req_id -> last result_data dict

def _ensure_last_result_store(self):
    if not hasattr(self, "last_result_by_req_id"):
        self.last_result_by_req_id = {}


def _process_cancel(self, req_id):
    """Clear pending NFC/sale state and acknowledge cancel."""
    self._ensure_last_result_store()
    if self.pending_result is not None:
        pr = self.pending_result
        self.pending_result = None
        # Optional: record cancelled outcome for queries
        rid = pr.get("req_id")
        if rid:
            self.last_result_by_req_id[rid] = {
                "status": "cancelled",
                "amount": pr.get("result_data", {}).get("amount", 0),
                "currency": pr.get("result_data", {}).get("currency", "GBP"),
            }
    self._send_result(req_id, "Cancel", "success", {})


def _process_get_transaction_status(self, req_id, args):
    """Query status by original Sale/Refund request id (args['req_id'])."""
    self._ensure_last_result_store()
    q = (args or {}).get("req_id") or (args or {}).get("request_id")
    if not q:
        self._send_result(req_id, "GetTransactionStatus", "error", {"error": "missing req_id"})
        return
    if self.pending_result is not None and self.pending_result.get("req_id") == q:
        # Still waiting for card / timeout
        pd = self.pending_result.get("result_data") or {}
        self._send_result(
            req_id,
            "GetTransactionStatus",
            "success",
            {
                "txn_status": "processing",
                "original_req_id": q,
                "amount": pd.get("amount", 0),
                "currency": pd.get("currency", "GBP"),
            },
        )
        return
    if q in self.last_result_by_req_id:
        data = dict(self.last_result_by_req_id[q])
        data["original_req_id"] = q
        data.setdefault("txn_status", data.get("status", "approved"))
        self._send_result(req_id, "GetTransactionStatus", "success", data)
        return
    self._send_result(
        req_id,
        "GetTransactionStatus",
        "error",
        {"error": "transaction not found"},
    )


# When Sale/Refund completes successfully, add to last_result_by_req_id, e.g.:
# self.last_result_by_req_id[req_id] = { "status": "approved", "amount": ..., "currency": ..., "txn_id": ... }
