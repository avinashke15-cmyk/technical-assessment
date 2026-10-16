# Policy Management API

Node.js + Express + MongoDB/Mongoose. CSV/XLSX imports run in a **Worker Thread** so parsing and bulk database writes do not block the main event loop.

## Requirements
- Node.js 14+
- MongoDB running locally or a MongoDB connection string
- MongoDB shell version v4.4.7

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```
Server: `http://localhost:3000`

## API endpoints

### Health
`GET /health`

### Upload CSV/XLSX
`POST /api/import`
- `multipart/form-data`
- file field name: `file`
- accepted extensions: `.csv`, `.xlsx`, `.xls`
- returns HTTP 202 with an import job ID; poll `GET /api/import/:jobId` for status/counts.

Example:
```bash
curl -F "file=@./sample.csv" http://localhost:3000/api/import
```

The importer accepts a flat spreadsheet. Header names are normalized, so `Agent Name`, `agent_name`, `agentName` are treated similarly. The provided assessment CSV was inspected: it has 1,198 rows and 28 columns. The importer maps its actual headers (`agent`, `userType`, `policy_number`, `company_name`, `category_name`, `policy_start_date`, `policy_end_date`, `account_name`, `email`, `firstname`, `phone`, `zip`, `dob`, etc.) and also supports common alternate header names. The file contains repeated email addresses for different first names/phone numbers, so users are keyed by email + first name + phone when email is present rather than email alone. The extra policy fields `policy_mode`, `producer`, `policy_type`, `premium_amount`, `premium_amount_written`, and `csr` are also retained.

Supported fields/aliases include:

| Entity | Example headers |
|---|---|
| Agent | `Agent Name` |
| User | `firstname`, `DOB`, `Address`, `phone`, `State`, `zip`, `email`, `gender`, `userType`, `city`, `account_type` |
| User Account | `Account Name` |
| LOB | `Policy Category`, `Category Name`, `LOB` |
| Carrier | `Policy Carrier`, `Company Name`, `Carrier` |
| Policy | `policy_number`, `policy_start_date`, `policy_end_date`, `policy_mode`, `policy_type`, `premium_amount`, `producer`, `csr` |

For linking policies to users, include a stable user identifier in the spreadsheet, preferably `Email`; otherwise the importer uses `First Name` plus `Phone Number`. If your source uses different headers, update aliases in `src/workers/import.worker.js`.

Rows with no usable user identity or no policy number are skipped. Re-importing data is designed to be idempotent for agents, users, accounts, LOBs, carriers, and policies.

### Search policy info by username
`GET /api/policies/search?username=alex`

Searches first name and email case-insensitively and returns matching users with their policies and populated LOB/carrier details.

### Aggregate policies by each user
`GET /api/policies/aggregate-by-user`
Optional filters: `?state=CA&userType=customer`

Returns each user, total policy count, and policy details.

### Other useful endpoints
- `GET /api/agents`
- `GET /api/users`
- `GET /api/accounts`
- `GET /api/lobs`
- `GET /api/carriers`
- `GET /api/policies`

## Collections
- `agents`
- `users`
- `useraccounts`
- `lobcategories`
- `policycarriers`
- `policies`

References in `Policy` use MongoDB ObjectIds for user, LOB, and carrier. The `User` document also has an optional `accountId` and `agentId`.

## Example CSV
```csv
Agent Name,First Name,DOB,Address,Phone Number,State,Zip Code,Email,Gender,User Type,Account Name,Policy Category,Policy Carrier,Policy Number,Policy Start Date,Policy End Date
Jordan Agent,Alice,1990-04-10,10 Main St,5551112222,CA,90001,alice@example.com,Female,Individual,Personal Account,Auto,Acme Insurance,POL-100,2025-01-01,2026-01-01
```

## Notes
- Date values should be parseable dates (ISO `YYYY-MM-DD` recommended).
- In production, add authentication/authorization, upload size limits, malware scanning, rate limiting, audit logs, and a durable job store (the sample job status is held in memory and resets on restart).
- For large imports, MongoDB unique indexes and `bulkWrite` upserts prevent duplicates. Each row is processed sequentially inside the worker to keep relationship resolution simple; for very large datasets, batch/parallelize carefully.


## Task 2: CPU monitoring and scheduled messages

### CPU monitor and restart
The process CPU is sampled every 5 seconds. If it stays at or above 70% for 3 consecutive samples, the app exits non-zero and PM2 restarts it. Install and run PM2:
```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 logs policy-management-api
pm2 save
```
CPU percent is measured relative to one CPU core and can exceed 100% on multi-core workloads. Tune `CPU_RESTART_THRESHOLD`, `CPU_MONITOR_INTERVAL_MS`, and `CPU_HIGH_SAMPLES` in `.env`. Repeated restarts can cause a restart loop; production systems should also alert/profile and use graceful shutdown.

### Schedule a message
`POST /api/messages` JSON body:
```json
{"message":"Send renewal reminder","day":"2026-12-01","time":"09:30"}
```
`day` is `YYYY-MM-DD`; `time` is 24-hour `HH:mm`, interpreted in the server's local timezone. The schedule is saved immediately in `scheduledmessages`; the actual message is inserted into `messages` when due. The polling interval defaults to 10 seconds, so insertion may occur up to about 10 seconds after the requested time.

Other endpoints: `GET /api/messages/scheduled` lists schedules and status; `GET /api/messages` lists inserted messages. This in-process scheduler is for assessment/demo use; production multi-instance deployments should use a durable scheduler/queue and explicit timezone semantics.
