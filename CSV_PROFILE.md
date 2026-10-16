# Supplied CSV profile

- File: `data-sheet - Node js Assesment (2) (1).csv`
- Rows: 1,198
- Columns: 28
- Policy numbers: 1,198 unique (no duplicates)
- Email addresses: 1,149 unique; repeated email addresses exist across different names/phone numbers.
- `gender` is blank in 463 rows.
- `city`, `address`, `state`, and `zip` are each blank in 18 rows.
- `premium_amount_written`, `primary`, `Applicant ID`, `agency_id`, and `hasActive ClientPolicy` are blank in all rows.

The importer retains all meaningful fields relevant to the requested collections and skips the columns that are entirely empty. `city` and `account_type` are retained as additional user fields. Extra policy data (`policy_mode`, `producer`, `policy_type`, `premium_amount`, `premium_amount_written`, `csr`) is retained in the policy document.
