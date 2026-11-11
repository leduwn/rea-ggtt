const fs = require('fs');

const meta = JSON.parse(fs.readFileSync('evidence/verified/metadata_index.json', 'utf8').replace(/^﻿/, ''));

const targetTypes = [
  'GGTT.Google_Tiktok_Form',
  'GGTT.Team.TeamWidget',
  'GGTT.Team.TeamGift',
  'GGTT.Team.TeamShift',
  'GGTT.Team.TeamStore',
  'GGTT.EmbeddedScriptRequest',
  'GGTT.Tracking.TrackedBody',
  'GGTT.Team.TeamScoringService',
  'GGTT.Effects.OwnedEffect',
  'GGTT.Effects.EffectDownload',
  'Detection',
  'LoginSession',
  'GGTT.TikTokVideoCatalogCommand',
  'GGTT.AppLogger',
  'TeamJournalPage',
  'GGTT.Google_Tiktok_Setting'
];

console.log('=== Inspecting Target High-Value Types in metadata_index.json ===\n');

const results = {};

targetTypes.forEach(tName => {
  // Find type token
  let typeToken = null;
  for (const [tok, name] of Object.entries(meta.typeMap)) {
    if (name === tName) {
      typeToken = tok;
      break;
    }
  }

  // Find methods
  const methods = [];
  for (const [tok, mName] of Object.entries(meta.methodMap)) {
    if (mName.startsWith(tName + '.')) {
      methods.push({ token: tok, name: mName.replace(tName + '.', '') });
    }
  }

  results[tName] = {
    typeToken,
    methodCount: methods.length,
    methods: methods.slice(0, 10) // preview first 10
  };

  console.log(`${tName} (token: ${typeToken || 'not found'}): ${methods.length} methods`);
  methods.slice(0, 5).forEach(m => console.log(`   - ${m.token}: ${m.name}`));
});
