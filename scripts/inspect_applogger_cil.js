const fs = require('fs');

const dumpPath = 'C:\\Users\\Duwn\\.claude\\projects\\d--REA-rea-ggtiktok\\996ae54f-f63f-4888-9a1b-bd5085efc544\\tool-results\\mcp-rea-inspect_managed_members-1794395887210.txt';
const data = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
const nr = data.normalized_result || data;

const strings = {};
if (nr.user_strings && nr.user_strings.literals) {
  nr.user_strings.literals.forEach(s => strings[s.token] = s.value);
}

const methods = {};
(nr.methods || []).forEach(m => methods[m.token] = m);

function dis(token) {
  const m = methods[token];
  if (!m) return `Method ${token} not found`;
  const lines = [`// ${m.declaring_type}::${m.name} (${token}) - Anchors: ${(m.body && m.body.anchors) ? m.body.anchors.length : 0}`];
  if (m.body && m.body.anchors) {
    m.body.anchors.forEach(a => {
      let op = a.operand !== null && a.operand !== undefined ? a.operand : '';
      if (strings[op]) op = JSON.stringify(strings[op]);
      lines.push(`  IL_${a.il_offset.toString(16).padStart(4, '0')}: ${a.opcode.padEnd(14, ' ')} ${op}`);
    });
  }
  return lines.join('\n');
}

console.log('=== AppLogger Strings ===');
for (const [k, v] of Object.entries(strings)) {
  console.log(`  ${k} => ${JSON.stringify(v)}`);
}

console.log('\n=== Disassembly: AppLogger.Initialize (0x06000212) ===');
console.log(dis('0x06000212').slice(0, 2000));

console.log('\n=== Disassembly: AppLogger.GetDiscordRetryDelayAsync (0x0600021a) ===');
console.log(dis('0x0600021a'));

console.log('\n=== Disassembly: AppLogger.SanitizeMetadata (0x0600021b) ===');
console.log(dis('0x0600021b'));

console.log('\n=== Disassembly: TeamScoringService.AddLedger (0x0600063a) ===');
console.log(dis('0x0600063a').slice(0, 2000));
