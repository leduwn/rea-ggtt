const fs = require('fs');
const path = require('path');

const invPath = 'evidence/binary/full-inventory.json';
if (!fs.existsSync(invPath)) {
  console.log(`[INFO] Offline raw evidence file '${invPath}' is gitignored in public repository.`);
  console.log('[INFO] Run this script locally with raw evidence present to verify target disk inventory.');
  process.exit(0);
}

const inv = JSON.parse(fs.readFileSync(invPath, 'utf8').replace(/^\uFEFF/, ''));
console.log('full-inventory.json entries:', inv.length);

const base = 'C:/Program Files (x86)/GGTT/';

let rootInInv = 0;
let subInInv = 0;
let invSubdirs = {};

for (const item of inv) {
  const norm = item.FullName.split('\\').join('/');
  if (norm.startsWith(base)) {
    const rel = norm.slice(base.length);
    if (!rel.includes('/')) {
      rootInInv++;
    } else {
      subInInv++;
      const top = rel.split('/')[0];
      invSubdirs[top] = (invSubdirs[top] || 0) + 1;
    }
  } else {
    console.log('Non-matching path in inv:', norm);
  }
}

console.log('Inv root files:', rootInInv);
console.log('Inv sub files:', subInInv);
console.log('Inv subdirs:', invSubdirs);

function walk(dir) {
  let results = [];
  try {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name).split('\\').join('/');
      if (ent.isDirectory()) {
        results = results.concat(walk(full));
      } else {
        const st = fs.statSync(full);
        results.push({ full, size: st.size, mtime: st.mtime.toISOString() });
      }
    }
  } catch (e) {
    console.error('walk error:', e.message);
  }
  return results;
}

const diskFiles = walk('C:/Program Files (x86)/GGTT');
console.log('Actual disk files count:', diskFiles.length);

let rootOnDisk = 0;
let subOnDisk = 0;
let diskSubdirs = {};

for (const f of diskFiles) {
  const rel = f.full.slice(base.length);
  if (!rel.includes('/')) {
    rootOnDisk++;
  } else {
    subOnDisk++;
    const top = rel.split('/')[0];
    diskSubdirs[top] = (diskSubdirs[top] || 0) + 1;
  }
}

console.log('Disk root files:', rootOnDisk);
console.log('Disk sub files:', subOnDisk);
console.log('Disk subdirs:', diskSubdirs);

// Where did 282 come from?
console.log('\n--- Investigating the 282 vs 360 discrepancy ---');
// Let's check subdirectories breakdown
console.log('Breakdown comparison:');
const allSubdirs = new Set([...Object.keys(invSubdirs), ...Object.keys(diskSubdirs)]);
for (const sub of allSubdirs) {
  console.log(`  Subdir ${sub}: inv=${invSubdirs[sub] || 0}, disk=${diskSubdirs[sub] || 0}`);
}

// Check difference: 360 - 282 = 78
// Let's check SpeechRuntime or runtimes or localization
console.log('\nLet check specific directories sizes:');
console.log('runtimes count in inv:', invSubdirs['runtimes']);
console.log('SpeechRuntime count in inv:', invSubdirs['SpeechRuntime']);
console.log('Tracking count in inv:', invSubdirs['Tracking']);
// Localization folders: de, es, fr, etc.
let locCount = 0;
for (const [k, v] of Object.entries(invSubdirs)) {
  if (k.length === 2 || k.includes('-')) locCount += v;
}
console.log('Localization language subdirs count in inv:', locCount);
