## E COMMERCE USAGE

### Customer adds items to cart, does not checkout

- ORDER_ABANDONMENT job scheduled at T+1h
- Reminder email sent at T+1h
- If still no checkout at T+24h, cart cancelled, inventory released

## Flash sale ends, reservations expire

- RESERVATION_EXPIRY jobs fire at T+10min per reservation
- quantityAvailable restored on inventory service

### Friday payout to all sellers

- PAYOUT_BATCH fires every Friday 09:00 WAT
- Paystack Transfer API called per seller with pending balance
- Ledger updated with PAYOUT debit

### Product stock drops below threshold

- LOW_STOCK_ALERT fires immediately
- Store owner notified via email
- Procurement team alerted


