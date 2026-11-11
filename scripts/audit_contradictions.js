const fs = require('fs');
const path = require('path');

const targetTokens = [
  '0x060004ab',
  '0x060004ac',
  '0x060004ae',
  '0x06000a46',
  '0x06000381',
  '0x06000382',
  '0x06000383',
  '0x06000384',
  '0x06000385',
  '0x06000386'
];

console.log('=== Checking evidence/cil/ ===');
if (fs.existsSync('evidence/cil')) {
  const files = fs.readdirSync('evidence/cil');
  targetTokens.forEach(t => {
    const m = files.filter(f => f.includes(t));
    if (m.length) console.log(t, '->', m);
  });
}

console.log('\n=== Checking evidence/functions/*.json ===');
const fdir = 'evidence/functions';
if (fs.existsSync(fdir)) {
  const files = fs.readdirSync(fdir).filter(f => f.endsWith('.json'));
  files.forEach(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(fdir, f), 'utf8'));
      const d = data.normalized_result || data;
      if (d.methods) {
        d.methods.forEach(m => {
          if (targetTokens.includes(m.token)) {
            console.log(`Found ${m.token} in ${f}:`);
            console.log(`  Declaring Type: ${m.declaring_type}`);
            console.log(`  Name: ${m.name}`);
            console.log(`  RVA: ${m.rva}`);
            console.log(`  Signature:`, m.signature);
          }
        });
      }
    } catch (e) {}
  });
}
