
const fs = require("fs");
const path = require("path");

const dir = process.env.REA_TOOL_RESULTS_DIR || path.resolve(__dirname, "../evidence/functions");

const allStrings = {};
const allFields = {};
const allMethods = {};
const allMemberRefs = {};
const allTypes = {};

if (fs.existsSync(dir)) {
  const resultFiles = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  resultFiles.forEach(f => {
    try {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const parsed = JSON.parse(raw);
      const d = parsed.normalized_result || parsed;
      if (!d) return;
      if (d.user_strings && d.user_strings.literals) {
        d.user_strings.literals.forEach(s => allStrings[s.token] = s.value);
      }
      if (d.fields) {
        d.fields.forEach(fld => allFields[fld.token] = fld.name);
      }
      if (d.types) {
        d.types.forEach(t => allTypes[t.token] = t.full_name || t.name);
      }
      if (d.member_refs) {
        d.member_refs.forEach(mr => {
          let cls = mr.declaring_type || mr.class_name;
          if (!cls && mr.class_token) cls = allTypes[mr.class_token] || mr.class_token;
          allMemberRefs[mr.token] = (cls ? cls + "::" : "") + mr.name;
        });
      }
      if (d.methods) {
        d.methods.forEach(m => allMethods[m.token] = m);
      }
    } catch(e) {
      // ignore parse errors
    }
  });
}

console.log("Total Indexed:");
console.log("- User Strings:", Object.keys(allStrings).length);
console.log("- Fields:", Object.keys(allFields).length);
console.log("- Methods:", Object.keys(allMethods).length);
console.log("- Types:", Object.keys(allTypes).length);
console.log("- MemberRefs:", Object.keys(allMemberRefs).length);

function disassemble(methodToken) {
  const m = allMethods[methodToken];
  if (!m) return "Method " + methodToken + " not found!";
  const out = [];
  out.push(`// Method: ${m.name} (${m.token})`);
  out.push(`// Declaring Type: ${m.declaring_type}`);
  if (m.signature) {
    out.push(`// Signature: ${m.signature.return_type} ${m.name}(${(m.signature.parameter_types||[]).join(", ")})`);
  }
  if (!m.body || !m.body.anchors) {
    out.push("// Body: empty / missing");
    return out.join("\n");
  }
  out.push(`// Instructions: ${m.body.instruction_count} | MaxStack: ${m.body.max_stack}`);
  out.push("");
  m.body.anchors.forEach(a => {
    let opStr = "";
    if (a.operand !== null && a.operand !== undefined) {
      if (allStrings[a.operand] !== undefined) {
        opStr = JSON.stringify(allStrings[a.operand]);
      } else if (allMemberRefs[a.operand]) {
        opStr = allMemberRefs[a.operand];
      } else if (allFields[a.operand]) {
        opStr = allFields[a.operand];
      } else if (allMethods[a.operand]) {
        opStr = allMethods[a.operand].declaring_type + "::" + allMethods[a.operand].name;
      } else {
        opStr = a.operand;
      }
    }
    const offHex = "IL_" + a.il_offset.toString(16).padStart(4, "0");
    out.push(`  ${offHex}: ${a.opcode.padEnd(14, " ")} ${opStr}`);
  });
  return out.join("\n");
}

module.exports = {
  allStrings,
  allFields,
  allMethods,
  allMemberRefs,
  allTypes,
  disassemble
};

if (require.main === module) {
  const target = process.argv[2] || "0x0600042e";
  console.log(disassemble(target));
}
