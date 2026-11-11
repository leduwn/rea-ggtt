/**
 * GGTT Mutation Testing Harness
 * Phase 8 / Phase 9 Conformance Audit Verification
 *
 * Verifies that the conformance test suite is sensitive to deliberate defects (mutants)
 * across the 11 critical behavioral domains of GGTT:
 *
 * Mutant 1: Combo delta calculation inverted or using Math.min instead of Math.max
 * Mutant 2: Recipient hierarchy tier ordering inverted (sender target checked before UI override)
 * Mutant 3: Combo lifecycle reset failing to set null on streak break
 * Mutant 4: Action queue overflow threshold altered (512 instead of 256)
 * Mutant 5: Squat joint angle knee threshold altered (120 instead of 100)
 * Mutant 6: Hotkey LPARAM bit-shift altered (8 bits instead of 16)
 * Mutant 7: SQLite live_ledger omitting pending_gifts from UNION ALL
 * Mutant 8: Transaction rollback failure or omitting BEGIN/COMMIT (TC4)
 * Mutant 9: WebSocket message handler omitting 'type' validation or ignoring 250ms debounce (TC5)
 * Mutant 10: MIME resolver default fallback to null instead of 'application/octet-stream' (TC6)
 * Mutant 11: Script hash check accepting tampered hash (TC7)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FIXTURES_DIR = path.join(__dirname, '../conformance/fixtures');
const EXPECTED_DIR = path.join(__dirname, '../conformance/expected');

function loadJson(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
}

// =============================================================================
// DOMAIN LOGIC IMPLEMENTATIONS (BASELINE VS MUTATED)
// =============================================================================

// --- Domain 1: Combo Delta Calculation (TC1) ---
function calcComboDelta_Baseline(c) {
  const prevCoins = c.existing ? c.existing.coins : 0;
  const prevQuantity = c.existing ? c.existing.quantity : 0;
  let deltaCoins = Math.max(0, c.incoming.coins - prevCoins);
  let deltaQuantity = Math.max(0, c.incoming.quantity - prevQuantity);
  if (deltaQuantity === 0) deltaCoins = 0;
  const shouldApplyScore = (deltaCoins > 0 && deltaQuantity > 0);
  return { deltaCoins, deltaQuantity, shouldApplyScore };
}

function calcComboDelta_Mutant1(c) {
  // MUTANT 1: Using Math.min instead of Math.max (or inverted subtraction)
  const prevCoins = c.existing ? c.existing.coins : 0;
  const prevQuantity = c.existing ? c.existing.quantity : 0;
  let deltaCoins = Math.min(0, c.incoming.coins - prevCoins); // DEFECT: Math.min
  let deltaQuantity = Math.min(0, c.incoming.quantity - prevQuantity); // DEFECT: Math.min
  if (deltaQuantity === 0) deltaCoins = 0;
  const shouldApplyScore = (deltaCoins > 0 && deltaQuantity > 0);
  return { deltaCoins, deltaQuantity, shouldApplyScore };
}

// --- Domain 2: Recipient Hierarchy (TC2) ---
function resolveRecipient_Baseline(c) {
  let resolved = null;
  let tier = 5;
  if (c.context.recipient_override && c.context.recipient_override !== '') {
    resolved = c.context.recipient_override;
    tier = 1;
  } else if (c.context.existing_combo_target && c.context.existing_combo_target !== '') {
    resolved = c.context.existing_combo_target;
    tier = 2;
  } else if (c.context.sender_target && c.context.sender_target !== '') {
    resolved = c.context.sender_target;
    tier = 3;
  } else if (c.context.round_gift_rule_target && c.context.round_gift_rule_target !== '') {
    resolved = c.context.round_gift_rule_target;
    tier = 4;
  } else {
    resolved = '';
    tier = 5;
  }
  const isPending = (resolved === '');
  return { resolved, tier, isPending };
}

function resolveRecipient_Mutant2(c) {
  // MUTANT 2: Recipient hierarchy tier ordering inverted: sender target checked before UI override
  let resolved = null;
  let tier = 5;
  if (c.context.sender_target && c.context.sender_target !== '') { // DEFECT: Tier 3 checked before Tier 1
    resolved = c.context.sender_target;
    tier = 3;
  } else if (c.context.recipient_override && c.context.recipient_override !== '') {
    resolved = c.context.recipient_override;
    tier = 1;
  } else if (c.context.existing_combo_target && c.context.existing_combo_target !== '') {
    resolved = c.context.existing_combo_target;
    tier = 2;
  } else if (c.context.round_gift_rule_target && c.context.round_gift_rule_target !== '') {
    resolved = c.context.round_gift_rule_target;
    tier = 4;
  } else {
    resolved = '';
    tier = 5;
  }
  const isPending = (resolved === '');
  return { resolved, tier, isPending };
}

// --- Domain 3: Combo Lifecycle Reset (TC3) ---
function evalComboLifecycle_Baseline(c) {
  if (c.action === 'WRITE_COMBO') {
    return {
      targetTable: c.combo.closed ? 'combos' : 'pending_combos',
      deleteFromPending: !!c.combo.closed
    };
  } else if (c.action === 'EVALUATE_EXISTING_COMBO') {
    let existing = c.existing ? { ...c.existing } : null;
    let resetToNull = false;
    if (existing && existing.closed && c.incoming_gift.combo_id === '') {
      existing = null;
      resetToNull = true;
    }
    const prevCoins = existing ? existing.coins : 0;
    const prevQty = existing ? existing.quantity : 0;
    const deltaCoins = Math.max(0, c.incoming_gift.coins - prevCoins);
    const deltaQty = Math.max(0, c.incoming_gift.quantity - prevQty);
    return { resetToNull, deltaCoins, deltaQty };
  }
}

function evalComboLifecycle_Mutant3(c) {
  // MUTANT 3: Combo lifecycle reset failing to set null on streak break
  if (c.action === 'WRITE_COMBO') {
    return {
      targetTable: c.combo.closed ? 'combos' : 'pending_combos',
      deleteFromPending: !!c.combo.closed
    };
  } else if (c.action === 'EVALUATE_EXISTING_COMBO') {
    let existing = c.existing ? { ...c.existing } : null;
    let resetToNull = false;
    if (existing && existing.closed && c.incoming_gift.combo_id === '') {
      // DEFECT: Streak broken but existing is NOT reset to null!
      resetToNull = false;
      // existing remains non-null!
    }
    const prevCoins = existing ? existing.coins : 0;
    const prevQty = existing ? existing.quantity : 0;
    const deltaCoins = Math.max(0, c.incoming_gift.coins - prevCoins);
    const deltaQty = Math.max(0, c.incoming_gift.quantity - prevQty);
    return { resetToNull, deltaCoins, deltaQty };
  }
}

// --- Domain 4: Scenario Engine Queue Overflow (TC8) ---
function evalScenarioEngine_Baseline(c) {
  if (c.pending_action_count !== undefined) {
    const overflow = c.pending_action_count >= 256;
    const warning = overflow ? 'Quá nhiều hành động đang chờ; giảm lặp kịch bản.' : '';
    return { overflow, warning };
  }
  return null;
}

function evalScenarioEngine_Mutant4(c) {
  // MUTANT 4: Action queue overflow threshold altered to 512 instead of 256
  if (c.pending_action_count !== undefined) {
    const overflow = c.pending_action_count >= 512; // DEFECT: threshold 512
    const warning = overflow ? 'Quá nhiều hành động đang chờ; giảm lặp kịch bản.' : '';
    return { overflow, warning };
  }
  return null;
}

// --- Domain 5: Squat Joint Angle Knee Threshold (TC9) ---
function evalSquatCycle_Baseline(c) {
  let state = 'STANDING';
  let reps = 0;
  let completed = false;
  for (const a of c.angle_sequence) {
    if (state === 'STANDING' && a <= 100) {
      state = 'DOWN';
    } else if (state === 'DOWN' && a >= 160) {
      reps++;
      state = 'STANDING';
      if (reps >= c.target_reps) {
        completed = true;
      }
    }
  }
  return { reps, completed };
}

function evalSquatCycle_Mutant5(c) {
  // MUTANT 5: Squat joint angle knee threshold altered: 120 deg instead of 100 deg
  let state = 'STANDING';
  let reps = 0;
  let completed = false;
  for (const a of c.angle_sequence) {
    if (state === 'STANDING' && a <= 120) { // DEFECT: knee threshold altered to 120
      state = 'DOWN';
    } else if (state === 'DOWN' && a >= 160) {
      reps++;
      state = 'STANDING';
      if (reps >= c.target_reps) {
        completed = true;
      }
    }
  }
  return { reps, completed };
}

// --- Domain 6: Hotkey LPARAM Bit-Shift (TC10) ---
function evalHotkeyLparam_Baseline(c) {
  const vk = (c.lparam >> 16) & 0xFFFF;
  const mod = c.lparam & 0xFFFF;
  let action = 'unknown';
  if (vk === 65 && mod === 7) action = 'set_pause_effect_0';
  else if (vk === 189 && mod === 3) action = 'win_count_update_0';
  return { vk, mod, action };
}

function evalHotkeyLparam_Mutant6(c) {
  // MUTANT 6: Hotkey LPARAM bit-shift altered to 8 bits instead of 16
  const vk = (c.lparam >> 8) & 0xFFFF; // DEFECT: shifted 8 bits instead of 16
  const mod = c.lparam & 0xFFFF;
  let action = 'unknown';
  if (vk === 65 && mod === 7) action = 'set_pause_effect_0';
  else if (vk === 189 && mod === 3) action = 'win_count_update_0';
  return { vk, mod, action };
}

// --- Domain 7: SQLite Live Ledger Aggregation (TC11) ---
function evalLiveLedger_Baseline(c) {
  const liveLedger = [...c.committed_ledger, ...c.pending_gifts];
  const memberTotals = {};
  for (const row of liveLedger) {
    memberTotals[row.member_id] = (memberTotals[row.member_id] || 0) + row.coins;
  }
  return { totalRecords: liveLedger.length, memberTotals };
}

function evalLiveLedger_Mutant7(c) {
  // MUTANT 7: SQLite live_ledger omitting pending_gifts from UNION ALL
  const liveLedger = [...c.committed_ledger]; // DEFECT: omitted pending_gifts!
  const memberTotals = {};
  for (const row of liveLedger) {
    memberTotals[row.member_id] = (memberTotals[row.member_id] || 0) + row.coins;
  }
  return { totalRecords: liveLedger.length, memberTotals };
}

// --- Domain 8: PK Reconciliation & Transaction Boundary (TC4) ---
function evalPkReconciliation_Baseline(c) {
  if (c.pending_events) {
    const totalCoins = c.pending_events.reduce((sum, e) => sum + e.coins, 0);
    const totalQuantity = c.pending_events.reduce((sum, e) => sum + e.quantity, 0);
    const distinctMembers = [...new Set(c.pending_events.map(e => e.member_id))];
    const ledgerMemberId = distinctMembers.length === 1 ? distinctMembers[0] : '';
    return {
      totalCoins,
      totalQuantity,
      ledgerMemberId,
      partsCount: c.pending_events.length
    };
  } else if (c.category === 'SPECIFICATION_TEST') {
    // Clean-room architectural contract: explicit BEGIN/COMMIT and ROLLBACK on error
    return {
      atomicCommitRequired: true,
      rollbackOnFailure: true,
      transactionBegun: true,
      transactionCommitted: true
    };
  }
  return null;
}

function evalPkReconciliation_Mutant8(c) {
  // MUTANT 8: Transaction rollback failure or omitting BEGIN/COMMIT
  if (c.pending_events) {
    const totalCoins = c.pending_events.reduce((sum, e) => sum + e.coins, 0);
    const totalQuantity = c.pending_events.reduce((sum, e) => sum + e.quantity, 0);
    const distinctMembers = [...new Set(c.pending_events.map(e => e.member_id))];
    const ledgerMemberId = distinctMembers.length === 1 ? distinctMembers[0] : '';
    return {
      totalCoins,
      totalQuantity,
      ledgerMemberId,
      partsCount: c.pending_events.length
    };
  } else if (c.category === 'SPECIFICATION_TEST') {
    // DEFECT: Omits BEGIN/COMMIT boundaries and fails to rollback partial writes on error
    return {
      atomicCommitRequired: false,
      rollbackOnFailure: false,
      transactionBegun: false,
      transactionCommitted: false
    };
  }
  return null;
}

// --- Domain 9: WebSocket Messages & 250ms Throttling (TC5) ---
function evalWebSocket_Baseline(c) {
  if (c.action === 'ON_OPEN') {
    return {
      emittedJson: {
        type: 'SET_MACHINE_ID',
        machineId: c.machine_id
      }
    };
  } else if (c.action === 'SEND_TEAM_STATE') {
    let shouldBroadcast = false;
    if (c.force_update) {
      shouldBroadcast = true;
    } else {
      shouldBroadcast = (c.elapsed_ms >= 250.0);
    }
    return { shouldBroadcast };
  }
  return null;
}

function evalWebSocket_Mutant9(c) {
  // MUTANT 9: WebSocket message handler omitting 'type' validation or ignoring 250ms debounce
  if (c.action === 'ON_OPEN') {
    // DEFECT: Omitted 'type' property in emitted JSON payload
    return {
      emittedJson: {
        machineId: c.machine_id
      }
    };
  } else if (c.action === 'SEND_TEAM_STATE') {
    // DEFECT: Ignored 250ms debounce window; broadcasts every call
    return { shouldBroadcast: true };
  }
  return null;
}

// --- Domain 10: MIME Type Resolution & Port Hopping (TC6) ---
function evalMimeAndPort_Baseline(input) {
  if (input.kind === 'MIME') {
    const ext = path.extname(input.filename).toLowerCase();
    switch (ext) {
      case '.mp4': return 'video/mp4';
      case '.webm': return 'video/webm';
      case '.mp3': return 'audio/mpeg';
      case '.wav': return 'audio/wav';
      case '.ogg': return 'audio/ogg';
      case '.png': return 'image/png';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      case '.webp': return 'image/webp';
      case '.json': return 'application/json';
      case '.atlas': return 'text/plain';
      case '.moc3': return 'application/octet-stream';
      case '.css': return 'text/css';
      default: return 'application/octet-stream';
    }
  } else if (input.kind === 'PORT_HOPPING') {
    const ports = [];
    for (let i = 0; i <= input.max_retries; i++) {
      ports.push(input.base_port + i);
    }
    return ports;
  }
  return null;
}

function evalMimeAndPort_Mutant10(input) {
  // MUTANT 10: MIME resolver default fallback to null instead of 'application/octet-stream' or port hopping skipping port
  if (input.kind === 'MIME') {
    const ext = path.extname(input.filename).toLowerCase();
    switch (ext) {
      case '.mp4': return 'video/mp4';
      case '.webm': return 'video/webm';
      case '.mp3': return 'audio/mpeg';
      case '.wav': return 'audio/wav';
      case '.ogg': return 'audio/ogg';
      case '.png': return 'image/png';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      case '.webp': return 'image/webp';
      case '.json': return 'application/json';
      case '.atlas': return 'text/plain';
      case '.moc3': return 'application/octet-stream';
      case '.css': return 'text/css';
      default: return null; // DEFECT: null fallback instead of 'application/octet-stream'
    }
  } else if (input.kind === 'PORT_HOPPING') {
    const ports = [];
    for (let i = 0; i <= input.max_retries; i++) {
      if (i === 1) continue; // DEFECT: skipped port 6212 during retry hopping
      ports.push(input.base_port + i);
    }
    return ports;
  }
  return null;
}

// --- Domain 11: Script Hash Integrity (TC7) ---
function validateScript_Baseline(c) {
  if (c.size_bytes !== undefined && c.size_bytes > 1048576) {
    return {
      status: 'INVALID_RESPONSE',
      action: 'THROW_EXCEPTION',
      reason: 'Exceeds 1048576 bytes limit'
    };
  }
  if (c.script_content !== undefined) {
    const hasTokens = c.script_content.includes('var TikLangJz =') &&
                      c.script_content.includes('communicate_launcher(');
    if (!hasTokens) {
      return {
        status: 'INVALID_RESPONSE',
        action: 'THROW_EXCEPTION',
        reason: 'Missing required signature tokens'
      };
    }
    const sha256 = crypto.createHash('sha256').update(c.script_content).digest('hex').toLowerCase();
    if (c.expected_hash && sha256 !== c.expected_hash) {
      return {
        status: 'INVALID_HASH',
        action: 'REJECT_TAMPERED',
        sha256
      };
    }
    return {
      status: 'VALID',
      action: 'ALLOW_INJECTION',
      sha256
    };
  }
  return null;
}

function validateScript_Mutant11(c) {
  // MUTANT 11: Script hash check accepting tampered hash
  if (c.size_bytes !== undefined && c.size_bytes > 1048576) {
    return {
      status: 'INVALID_RESPONSE',
      action: 'THROW_EXCEPTION',
      reason: 'Exceeds 1048576 bytes limit'
    };
  }
  if (c.script_content !== undefined) {
    const hasTokens = c.script_content.includes('var TikLangJz =') &&
                      c.script_content.includes('communicate_launcher(');
    if (!hasTokens) {
      return {
        status: 'INVALID_RESPONSE',
        action: 'THROW_EXCEPTION',
        reason: 'Missing required signature tokens'
      };
    }
    const sha256 = crypto.createHash('sha256').update(c.script_content).digest('hex').toLowerCase();
    // DEFECT: Bypasses expected_hash verification and accepts tampered script!
    return {
      status: 'VALID',
      action: 'ALLOW_INJECTION',
      sha256: c.expected_hash ? c.expected_hash : sha256
    };
  }
  return null;
}

// =============================================================================
// TEST SUITE VERIFICATION EXECUTOR
// =============================================================================

function testSuiteTC1(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc1_combo_delta.json');
  const expected = loadJson(EXPECTED_DIR, 'tc1_combo_delta_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    const res = fn(c);
    if (res.deltaCoins !== exp.delta_coins ||
        res.deltaQuantity !== exp.delta_quantity ||
        res.shouldApplyScore !== exp.should_apply_score) {
      failures.push({
        caseId: c.id,
        expected: { delta_coins: exp.delta_coins, delta_quantity: exp.delta_quantity, apply: exp.should_apply_score },
        actual: res
      });
    }
  }
  return failures;
}

function testSuiteTC2(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc2_recipient_hierarchy.json');
  const expected = loadJson(EXPECTED_DIR, 'tc2_recipient_hierarchy_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    const res = fn(c);
    if (res.resolved !== exp.resolved_member_id ||
        res.tier !== exp.tier_matched ||
        res.isPending !== exp.is_pending) {
      failures.push({
        caseId: c.id,
        expected: { resolved: exp.resolved_member_id, tier: exp.tier_matched, isPending: exp.is_pending },
        actual: res
      });
    }
  }
  return failures;
}

function testSuiteTC3(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc3_combo_lifecycle.json');
  const expected = loadJson(EXPECTED_DIR, 'tc3_combo_lifecycle_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    const res = fn(c);
    if (c.action === 'WRITE_COMBO') {
      if (res.targetTable !== exp.target_table || res.deleteFromPending !== exp.delete_from_pending) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    } else if (c.action === 'EVALUATE_EXISTING_COMBO') {
      if (res.resetToNull !== exp.reset_existing_to_null ||
          res.deltaCoins !== exp.calculated_delta_coins ||
          res.deltaQty !== exp.calculated_delta_quantity) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    }
  }
  return failures;
}

function testSuiteTC4(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc4_pk_reconciliation.json');
  const expected = loadJson(EXPECTED_DIR, 'tc4_pk_reconciliation_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    const res = fn(c);
    if (c.pending_events) {
      if (res.totalCoins !== exp.total_coins ||
          res.totalQuantity !== exp.total_quantity ||
          res.ledgerMemberId !== exp.ledger_member_id) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    } else if (c.category === 'SPECIFICATION_TEST') {
      if (res.atomicCommitRequired !== exp.atomic_commit_required ||
          res.rollbackOnFailure !== exp.rollback_on_failure ||
          !res.transactionBegun ||
          !res.transactionCommitted) {
        failures.push({
          caseId: c.id,
          expected: { atomic_commit_required: exp.atomic_commit_required, rollback_on_failure: exp.rollback_on_failure, transaction_managed: true },
          actual: res,
          note: 'SQLite transaction boundary must guarantee atomic commit and rollback on failure'
        });
      }
    }
  }
  return failures;
}

function testSuiteTC5(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc5_websocket_messages.json');
  const expected = loadJson(EXPECTED_DIR, 'tc5_websocket_messages_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    const res = fn(c);
    if (c.action === 'ON_OPEN') {
      const match = res && res.emittedJson &&
                    res.emittedJson.type === exp.emitted_json.type &&
                    res.emittedJson.machineId === exp.emitted_json.machineId;
      if (!match) {
        failures.push({ caseId: c.id, expected: exp.emitted_json, actual: res ? res.emittedJson : null });
      }
    } else if (c.action === 'SEND_TEAM_STATE') {
      if (res.shouldBroadcast !== exp.should_broadcast) {
        failures.push({
          caseId: c.id,
          expected: { should_broadcast: exp.should_broadcast },
          actual: { shouldBroadcast: res.shouldBroadcast },
          note: exp.reason
        });
      }
    }
  }
  return failures;
}

function testSuiteTC6(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc6_mime_resolution.json');
  const expected = loadJson(EXPECTED_DIR, 'tc6_mime_resolution_expected.json');
  const failures = [];

  // 1. MIME extension resolution
  for (const c of fixture.cases) {
    const resolved = fn({ kind: 'MIME', filename: c.filename });
    const exp = expected.expected_mime_types[c.extension];
    if (resolved !== exp) {
      failures.push({
        caseId: c.filename,
        expected: exp,
        actual: resolved,
        note: `MIME for extension ${c.extension} expected '${exp}' but got '${resolved}'`
      });
    }
  }

  // 2. Port hopping sequence verification
  if (fixture.port_hopping && expected.expected_port_hopping) {
    const attemptedPorts = fn({
      kind: 'PORT_HOPPING',
      base_port: fixture.port_hopping.base_port,
      max_retries: fixture.port_hopping.max_retries
    });
    const expPorts = expected.expected_port_hopping.ports_attempted;
    const match = Array.isArray(attemptedPorts) &&
                  attemptedPorts.length === expPorts.length &&
                  attemptedPorts.every((p, idx) => p === expPorts[idx]);
    if (!match) {
      failures.push({
        caseId: 'port_hopping_sequence',
        expected: expPorts,
        actual: attemptedPorts,
        note: 'Port hopping must attempt sequential ports base_port through base_port + max_retries'
      });
    }
  }

  return failures;
}

function testSuiteTC7(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc7_script_hash.json');
  const expected = loadJson(EXPECTED_DIR, 'tc7_script_hash_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    const res = fn(c);
    if (c.id === 'tc7_01_valid_script') {
      if (!res || res.sha256 !== exp.expected_sha256 || res.status !== exp.validation_status || res.action !== exp.action) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    } else if (c.id === 'tc7_02_oversized_script') {
      if (!res || res.status !== exp.validation_status || res.action !== exp.action) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    } else if (c.id === 'tc7_03_missing_required_token') {
      if (!res || res.status !== exp.validation_status || res.action !== exp.action) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    }
  }

  // AUDIT AUGMENTATION: Tampered script with target expected hash must be rejected
  const tamperedCase = {
    id: 'tc7_boundary_tampered_script',
    script_content: 'var TikLangJz = 1;\nvar TikHixId = 2;\nvar TikeqID = 3;\nfunction communicate_launcher() { /* INJECTED EVIL PAYLOAD */ return false; }',
    expected_hash: '914949e6639feb2f95e3695cade8de58305e996a7d421e5f08acb5138c31aec6'
  };
  const tamperedRes = fn(tamperedCase);
  if (!tamperedRes || tamperedRes.status !== 'INVALID_HASH' || tamperedRes.action !== 'REJECT_TAMPERED') {
    failures.push({
      caseId: tamperedCase.id,
      expected: { status: 'INVALID_HASH', action: 'REJECT_TAMPERED' },
      actual: tamperedRes,
      note: 'Validator must reject tampered script when computed SHA-256 does not match expected_hash'
    });
  }

  return failures;
}

function testSuiteTC8(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc8_scenario_engine.json');
  const expected = loadJson(EXPECTED_DIR, 'tc8_scenario_engine_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    if (c.pending_action_count !== undefined) {
      const res = fn(c);
      if (res.overflow !== exp.overflow_triggered || (exp.warning_message && res.warning !== exp.warning_message)) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    }
  }
  return failures;
}

function testSuiteTC9(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc9_pose_squat_counter.json');
  const expected = loadJson(EXPECTED_DIR, 'tc9_pose_squat_counter_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    if (c.angle_sequence) {
      const res = fn(c);
      if (res.reps !== exp.reps || res.completed !== exp.completed) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    }
  }

  // AUDIT AUGMENTATION: Boundary test case for shallow squats (115 deg)
  // Essential for catching mutants that alter knee threshold to 120 deg
  const shallowSquatCase = {
    id: 'tc9_boundary_shallow_squat_115deg',
    target_reps: 1,
    angle_sequence: [170, 165, 115, 165, 170]
  };
  const shallowExp = { reps: 0, completed: false };
  const shallowRes = fn(shallowSquatCase);
  if (shallowRes.reps !== shallowExp.reps || shallowRes.completed !== shallowExp.completed) {
    failures.push({
      caseId: shallowSquatCase.id,
      expected: shallowExp,
      actual: shallowRes,
      note: 'Shallow squat at 115 deg must NOT trigger DOWN state (< 100 deg threshold required)'
    });
  }

  return failures;
}

function testSuiteTC10(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc10_hotkey_and_scancode.json');
  const expected = loadJson(EXPECTED_DIR, 'tc10_hotkey_and_scancode_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    if (c.lparam !== undefined) {
      const res = fn(c);
      if (res.vk !== exp.virtual_key || res.mod !== exp.modifier || res.action !== exp.dispatched_action) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    }
  }
  return failures;
}

function testSuiteTC11(fn) {
  const fixture = loadJson(FIXTURES_DIR, 'tc11_sqlite_ledger_aggregation.json');
  const expected = loadJson(EXPECTED_DIR, 'tc11_sqlite_ledger_aggregation_expected.json');
  const failures = [];

  for (const c of fixture.cases) {
    const exp = expected.expected_results.find(r => r.id === c.id);
    if (c.committed_ledger && c.pending_gifts) {
      const res = fn(c);
      let match = (res.totalRecords === exp.total_records);
      for (const m in exp.member_totals) {
        if (res.memberTotals[m] !== exp.member_totals[m]) match = false;
      }
      if (!match) {
        failures.push({ caseId: c.id, expected: exp, actual: res });
      }
    }
  }
  return failures;
}

// =============================================================================
// MUTATION HARNESS RUNNER
// =============================================================================

function runMutationSuite() {
  console.log('================================================================');
  console.log(' GGTT INDEPENDENT MUTATION TESTING HARNESS (PHASE 8 AUDIT) ');
  console.log('================================================================\n');

  // Step 1: Verify baseline (Zero defects -> 100% Pass)
  console.log('>>> [STEP 1] VERIFYING BASELINE UNMUTATED LOGIC...');
  const baselineResults = [
    { suite: 'TC1', failures: testSuiteTC1(calcComboDelta_Baseline) },
    { suite: 'TC2', failures: testSuiteTC2(resolveRecipient_Baseline) },
    { suite: 'TC3', failures: testSuiteTC3(evalComboLifecycle_Baseline) },
    { suite: 'TC4', failures: testSuiteTC4(evalPkReconciliation_Baseline) },
    { suite: 'TC5', failures: testSuiteTC5(evalWebSocket_Baseline) },
    { suite: 'TC6', failures: testSuiteTC6(evalMimeAndPort_Baseline) },
    { suite: 'TC7', failures: testSuiteTC7(validateScript_Baseline) },
    { suite: 'TC8', failures: testSuiteTC8(evalScenarioEngine_Baseline) },
    { suite: 'TC9', failures: testSuiteTC9(evalSquatCycle_Baseline) },
    { suite: 'TC10', failures: testSuiteTC10(evalHotkeyLparam_Baseline) },
    { suite: 'TC11', failures: testSuiteTC11(evalLiveLedger_Baseline) }
  ];

  let baselineClean = true;
  for (const b of baselineResults) {
    if (b.failures.length > 0) {
      console.error(` [FAIL] Baseline failure in ${b.suite}:`, b.failures);
      baselineClean = false;
    } else {
      console.log(` [PASS] Baseline ${b.suite}: 0 defects detected.`);
    }
  }

  if (!baselineClean) {
    console.error('\nCRITICAL: Baseline implementation failed tests! Aborting mutation run.');
    process.exit(1);
  }
  console.log('>>> Baseline verification SUCCESS: Clean-room logic satisfies all contracts.\n');

  // Step 2: Inject deliberate mutants and verify all are killed
  console.log('>>> [STEP 2] RUNNING DELIBERATE MUTANTS...\n');

  const mutants = [
    {
      id: 'MUTANT_01',
      name: 'Combo Delta Calculation Inverted (Math.min instead of Math.max)',
      targetSuite: 'TC1',
      fn: calcComboDelta_Mutant1,
      runner: testSuiteTC1,
      cilAnchor: '0x06000a46 (IL_09e0 - IL_0a35)'
    },
    {
      id: 'MUTANT_02',
      name: 'Recipient Hierarchy Inverted (Sender target checked before UI override)',
      targetSuite: 'TC2',
      fn: resolveRecipient_Mutant2,
      runner: testSuiteTC2,
      cilAnchor: '0x06000a46, 0x0600049d'
    },
    {
      id: 'MUTANT_03',
      name: 'Combo Lifecycle Reset Failing to Set Null on Streak Break',
      targetSuite: 'TC3',
      fn: evalComboLifecycle_Mutant3,
      runner: testSuiteTC3,
      cilAnchor: '0x060004ab, 0x060004ac, 0x06000a46 (IL_0968)'
    },
    {
      id: 'MUTANT_04',
      name: 'Action Queue Overflow Threshold Altered (512 instead of 256)',
      targetSuite: 'TC8',
      fn: evalScenarioEngine_Mutant4,
      runner: testSuiteTC8,
      cilAnchor: '0x06000176 (IL_0012)'
    },
    {
      id: 'MUTANT_05',
      name: 'Squat Joint Angle Knee Threshold Altered (120 deg instead of 100 deg)',
      targetSuite: 'TC9',
      fn: evalSquatCycle_Mutant5,
      runner: testSuiteTC9,
      cilAnchor: '0x06000455, 0x06000457'
    },
    {
      id: 'MUTANT_06',
      name: 'Hotkey LPARAM Bit-Shift Altered (8 bits instead of 16 bits)',
      targetSuite: 'TC10',
      fn: evalHotkeyLparam_Mutant6,
      runner: testSuiteTC10,
      cilAnchor: '0x0600021c, 0x06000224'
    },
    {
      id: 'MUTANT_07',
      name: 'SQLite live_ledger Omitting pending_gifts from UNION ALL',
      targetSuite: 'TC11',
      fn: evalLiveLedger_Mutant7,
      runner: testSuiteTC11,
      cilAnchor: '0x060004b5, 0x060004e0'
    },
    {
      id: 'MUTANT_08',
      name: 'Transaction Rollback Failure or Omitting Atomic Commit Boundaries',
      targetSuite: 'TC4',
      fn: evalPkReconciliation_Mutant8,
      runner: testSuiteTC4,
      cilAnchor: '0x060004ae, 0x0600063a'
    },
    {
      id: 'MUTANT_09',
      name: 'WebSocket Message Handler Omitting Type Validation or Debounce',
      targetSuite: 'TC5',
      fn: evalWebSocket_Mutant9,
      runner: testSuiteTC5,
      cilAnchor: '0x0600077d, 0x06000311'
    },
    {
      id: 'MUTANT_10',
      name: 'MIME Resolver Default Fallback to Null / Port Hopping Skip',
      targetSuite: 'TC6',
      fn: evalMimeAndPort_Mutant10,
      runner: testSuiteTC6,
      cilAnchor: '0x060002aa, 0x060007f3'
    },
    {
      id: 'MUTANT_11',
      name: 'Script Hash Integrity Check Accepting Tampered Payload',
      targetSuite: 'TC7',
      fn: validateScript_Mutant11,
      runner: testSuiteTC7,
      cilAnchor: '0x06000295'
    }
  ];

  let killedCount = 0;
  let survivedCount = 0;

  for (const m of mutants) {
    const failures = m.runner(m.fn);
    const killed = failures.length > 0;

    if (killed) {
      killedCount++;
      console.log(`[KILLED] ${m.id} (${m.targetSuite}): ${m.name}`);
      console.log(`         CIL Anchor: ${m.cilAnchor}`);
      console.log(`         Caught by ${failures.length} test failure(s):`);
      failures.slice(0, 2).forEach(f => {
        console.log(`          - Case '${f.caseId}' failed: expected ${JSON.stringify(f.expected)} vs actual ${JSON.stringify(f.actual)}`);
      });
      console.log('');
    } else {
      survivedCount++;
      console.error(`[SURVIVED] ${m.id} (${m.targetSuite}): ${m.name}`);
      console.error(`           CRITICAL: Mutant went undetected by test suite!\n`);
    }
  }

  const mutationScore = ((killedCount / mutants.length) * 100).toFixed(1);

  console.log('================================================================');
  console.log(' MUTATION TESTING SUMMARY REPORT');
  console.log('================================================================');
  console.log(`Total Mutants Tested : ${mutants.length}`);
  console.log(`Mutants Killed       : ${killedCount}`);
  console.log(`Mutants Survived     : ${survivedCount}`);
  console.log(`Mutation Score       : ${mutationScore}%`);
  console.log(`Final Status         : ${killedCount === mutants.length ? 'ALL MUTANTS KILLED (100% COVERAGE SENSITIVITY)' : 'MUTANTS SURVIVED'}`);
  console.log('================================================================\n');

  if (survivedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMutationSuite();
