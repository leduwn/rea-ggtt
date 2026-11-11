const fs = require('fs');

const dumpPath = 'C:\\Users\\Duwn\\.claude\\projects\\d--REA-rea-ggtiktok\\996ae54f-f63f-4888-9a1b-bd5085efc544\\tool-results\\mcp-rea-inspect_managed_members-1794395887210.txt';
console.log('Loading REA dump...');
const raw = fs.readFileSync(dumpPath, 'utf8');
const data = JSON.parse(raw);
const nr = data.normalized_result || data;

console.log('Artifact:', nr.artifact ? nr.artifact.name : 'unknown');
console.log('Types returned:', (nr.types || []).map(t => t.name || t.full_name));
console.log('Methods count:', (nr.methods || []).length);
console.log('User strings count:', (nr.user_strings && nr.user_strings.literals) ? nr.user_strings.literals.length : 0);

// Inspect AppLogger methods
const appLoggerMethods = (nr.methods || []).filter(m => m.declaring_type === 'GGTT.AppLogger');
console.log('\n=== GGTT.AppLogger Methods ===');
appLoggerMethods.forEach(m => {
  console.log(`- ${m.token} ${m.name} (RVA: ${m.rva}, anchors: ${(m.body && m.body.anchors) ? m.body.anchors.length : 0})`);
});

// Inspect Google_Tiktok_Setting methods
const settingMethods = (nr.methods || []).filter(m => m.declaring_type === 'GGTT.Google_Tiktok_Setting');
console.log('\n=== GGTT.Google_Tiktok_Setting Methods ===');
settingMethods.forEach(m => {
  console.log(`- ${m.token} ${m.name} (RVA: ${m.rva}, anchors: ${(m.body && m.body.anchors) ? m.body.anchors.length : 0})`);
});

// Inspect TeamScoringService methods
const scoringMethods = (nr.methods || []).filter(m => m.declaring_type === 'GGTT.Team.TeamScoringService');
console.log('\n=== GGTT.Team.TeamScoringService Methods ===');
scoringMethods.forEach(m => {
  console.log(`- ${m.token} ${m.name} (RVA: ${m.rva}, anchors: ${(m.body && m.body.anchors) ? m.body.anchors.length : 0})`);
});
