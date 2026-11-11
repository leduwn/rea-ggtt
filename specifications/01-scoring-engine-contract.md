# Clean-Room Specification 01: Live PK Scoring Engine Contract

- **Spec ID**: `SPEC-01`
- **Subsystem**: `LIVE_PK_TEAM_SCORING`
- **Authoritative Proof**: `CLM-01`, `CLM-02`, `CLM-11` (`0x06000a46`, `0x0600049d`, `0x0600063a`, `0x0600063b`)

## 1. Gift Delta Computation Rule
No multiplier (e.g., 1.5x, 2x, streak bonus) shall be applied to gift scoring. All calculations use strictly additive delta subtraction against the previous cumulative state of the active streak.

Given an incoming `GiftEvent` (`Coins`, `Quantity`, `ComboId`, `SenderId`, `GiftId`, `RepeatEnd`) and the persisted `ExistingCombo` (`Coins`, `Quantity`, `Closed`):

1. **Streak Reset Condition**:
   - If `ExistingCombo != null` AND `ExistingCombo.Closed == true` AND `string.IsNullOrEmpty(GiftEvent.ComboId)`:
     Treat `ExistingCombo` as `null` (initiate a fresh combo streak).
2. **Delta Calculation**:
   - `deltaQuantity = Math.Max(0, GiftEvent.Quantity - (ExistingCombo?.Quantity ?? 0))`
   - `deltaCoins = Math.Max(0, GiftEvent.Coins - (ExistingCombo?.Coins ?? 0))`
3. **Zero-Quantity Clamping**:
   - If `deltaQuantity == 0`: force `deltaCoins = 0`.
4. **Test / Ignored Gift Exclusion**:
   - If `GiftEvent.RepeatEnd == 9981` OR `GiftEvent.Test == true` OR `GiftEvent.SenderId == "12210"`: bypass or route to non-scored simulation path as defined by channel flags.

## 2. 5-Tier Recipient Resolution Hierarchy
Recipient assignment must short-circuit strictly in the following priority order:

| Priority | Tier | Source | Condition | Outcome |
|:---:|---|---|---|
| 1 | **UI Manual Override** | Operator input override parameter | `overrideMemberId != null` | Assigns `member_id = overrideMemberId` |
| 2 | **Active Combo Streak Lock** | `ExistingCombo.TargetRule` | Active streak has locked recipient | Preserves streak `member_id` |
| 3 | **Sender Target Rule** | SQLite table `sender_targets` | Record exists for `SenderId` | Assigns mapped `member_id` |
| 4 | **Round Gift Rule** | Active round configuration | Gift matches `TeamPkGiftRule` | Assigns rule target `member_id` |
| 5 | **Pending Unassigned Queue** | Default fallback | None of tiers 1-4 matched | Sets `member_id = ""`, routes entry to `pending_gifts` table instead of `ledger` |

## 3. Event Deduplication Contract
- Incoming TikTok events (`gift`, `comment`, `like`, `member`) must be deduplicated using a sliding buffer keyed by `(message_id, combo_id)` before entering delta scoring.
- Replayed or duplicate packets within the buffer window must be silently dropped without invoking database mutations.
