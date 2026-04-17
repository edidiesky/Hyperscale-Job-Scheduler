## FINANCE

### Daily reconciliation
- SCHEDULED_REPORT fires every day at 23:59
- Transaction ledger balanced
- Discrepancies flagged for ops review

### Loan repayment reminders
- ORDER_ABANDONMENT (repurposed) fires 3 days before due date
- SMS + email reminder sent to borrower

### Failed payment retry
- PAYOUT_BATCH fires on schedule
- Failed transfers retried with exponential backoff
- After MAX_RETRIES, routed to dead letter for manual review
