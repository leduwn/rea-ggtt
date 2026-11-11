# Clean-Room Specification 04: Visual Effects & Scenario Engine Contract

- **Spec ID**: `SPEC-04`
- **Subsystem**: `VISUAL_EFFECTS_SCENARIO_ENGINE`
- **Authoritative Proof**: `CLM-08` (`0x0600042e`, `0x0600042f`)

## 1. Scenario Condition Tree Evaluation (`Evaluate`)
Conditions are evaluated recursively against `(Condition condition, double elapsed, Context context)`:

1. **`group` Conditions**:
   - `logic == "all"`: Iterates through child conditions. Short-circuits and returns `false` on first non-matching child. Returns `true` if all match.
   - `logic == "any"`: Iterates through child conditions. Short-circuits and returns `true` on first matching child. Returns `false` if none match.
2. **`time` Conditions**:
   - Evaluates `elapsed` against `condition.number`.
   - Operators: `"eq"` (`elapsed == number`), `"ne"` (`elapsed != number`), and edge-trigger step (`elapsed >= number && previousElapsed < number`).
3. **`data` Conditions**:
   - Extracts `context.Data[condition.field]` and executes type-aware comparisons (string/numeric).
4. **`random` Conditions**:
   - Compares pseudo-random generator draw against `condition.number` probability threshold.

## 2. Action Queue Dispatch & 256 Item Ceiling (`Tick`)
During each engine tick cycle:
1. Pending actions are ordered by priority and execution timestamp.
2. **Queue Capacity Limit**:
   The engine must strictly cap processed actions using:
   `var batch = pending.OrderBy(...).Take(256).ToList();`
   Any actions exceeding 256 remain deferred in `_pending` for subsequent ticks.
3. **Queue Cancellation (`cancel_pending`)**:
   `pending.RemoveAll(a => a.Group == targetGroup);`

## 3. State Arithmetic Clamping
When mutating numeric state variables:
- **`set_state`**: Assigns `_variables[target] = value`.
- **`add_state`**: Accumulates `current + value` and clamps strictly within:
  `_variables[target] = Math.Max(-1000000.0, Math.Min(1000000.0, current + value));`
  Preventing IEEE-754 floating point overflow and NaN propagation.
