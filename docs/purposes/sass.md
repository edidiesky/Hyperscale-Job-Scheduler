## SASS PLATFORM

### Trial expires in 3 days

- SCHEDULED_REPORT job fires at T+trial_end-3days
- Upgrade reminder email sent to user

### Subscription renewal due

- Job fires 24h before renewal date
- Payment attempted, receipt sent, or dunning email triggered

### Weekly usage summary

- SCHEDULED_REPORT every Monday 08:00
- Per-tenant API usage, storage, seats summarised
- Email sent to account owner

### Inactive user cleanup

- Job fires 90 days after last login
- Account flagged for deletion, user notified
