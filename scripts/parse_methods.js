const fs = require('fs');

function inspectResult(filePath, outPath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = data.normalized_result.page.rows;
  console.log(`Parsed ${rows.length} rows.`);
  const summary = rows.map(r => ({
    token: r.token,
    name: r.name,
    declaring_type: r.declaring_type,
    rva: r.rva,
    impl_flags: r.impl_flags,
    flags: r.flags,
    signature: r.signature ? `${r.signature.return_type} ${r.name}(${(r.signature.parameter_types || []).join(', ')})` : null,
    il_sha256: r.body ? r.body.il_sha256 : null,
    instruction_count: r.body ? r.body.instruction_count : 0,
    anchors: r.body && r.body.anchors ? r.body.anchors.slice(0, 15).map(i => `${i.il_offset.toString(16)}: ${i.opcode} ${i.operand ? JSON.stringify(i.operand) : ''}`) : []
  }));
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Wrote summary to ${outPath}`);
}

const input = process.argv[2];
const output = process.argv[3];
inspectResult(input, output);
