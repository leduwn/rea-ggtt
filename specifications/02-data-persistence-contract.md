# Clean-Room Specification 02: Data Persistence & SQLite Ledger Contract

- **Spec ID**: `SPEC-02`
- **Subsystem**: `DATA_PERSISTENCE_LIFECYCLE`
- **Authoritative Proof**: `CLM-03`, `CLM-04` (`0x060004ab`, `0x060004ac`, `0x060004ae`, `0x060004b5`, `0x060004ca`)

## 1. SQLite Connection & Journal Pragmas
Every database connection opened by the persistence engine must immediately execute:
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=FULL;
PRAGMA busy_timeout=5000;
```

## 2. Pre-Migration Automatic Backup Rule
Prior to executing any schema DDL migration (`PRAGMA user_version` bump):
1. Ensure directory `<StoreRoot>/backups` exists.
2. Snapshot the active database atomically to:
   `<StoreRoot>/backups/before-continuous-{yyyyMMdd-HHmmss-fff}.db`
3. Only proceed with `ALTER TABLE` / `CREATE TABLE` DDL after backup verification succeeds.

## 3. Schema v3 Required Tables & Indexes
1. **`ledger` and `pending_gifts` Columns**:
   - `id`, `shift_id`, `group_id`, `channel`, `channel_uid`, `member_id`, `sender_id`, `gift_id`, `coins`, `quantity`, `occurred_at`, `round_id`, `kind`, `note`, `source`, `widget_rounds`, `journal_id`, `deleted_at`, `revision`, `parts`
2. **Audit Table `ledger_changes`**:
   ```sql
   CREATE TABLE IF NOT EXISTS ledger_changes (
     id TEXT PRIMARY KEY,
     entry_id TEXT NOT NULL,
     action TEXT NOT NULL,
     before_json TEXT NOT NULL,
     after_json TEXT NOT NULL,
     at TEXT NOT NULL
   );
   ```
3. **Required Indexes**:
   ```sql
   CREATE INDEX IF NOT EXISTS ledger_group_channel ON ledger(group_id, channel_uid, channel, member_id);
   CREATE INDEX IF NOT EXISTS ledger_group_time ON ledger(group_id, occurred_at);
   ```

## 4. Dual-Table Combo Lifecycle & Optimistic Concurrency
- **Active Combos (`Closed == false`)**: Stored in `pending_combos` via `INSERT ... ON CONFLICT(id) DO UPDATE SET json=excluded.json`.
- **Closed Combos (`Closed == true`)**: Stored in `combos` via `INSERT ... ON CONFLICT(id) DO UPDATE`, followed immediately by `DELETE FROM pending_combos WHERE id=$id`.
- **Reading Combos**: Query `SELECT json FROM pending_combos WHERE id=$id UNION ALL SELECT json FROM combos WHERE id=$id LIMIT 1`.
- **Optimistic Revision Locking**: Any mutation to an existing ledger entry must increment `revision = revision + 1` conditionally within an ACID transaction, rolling back on conflict or exception.
- **Combo Commit Assembly**: `CommitGiftCombo` gathers all pending gift parts for a `journal_id` ordered by `(occurred_at, rowid)`, serializes them into a JSON array `parts`, and persists the unified ledger row atomically.
