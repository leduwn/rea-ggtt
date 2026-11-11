const fs = require('fs');

const meta = JSON.parse(fs.readFileSync('evidence/verified/metadata_index.json', 'utf8').replace(/^﻿/, ''));

const focusTypes = [
  'GGTT.Team.TeamScoringService',
  'GGTT.Team.TeamStore',
  'GGTT.Effects.OwnedEffect',
  'GGTT.Effects.EffectDownload',
  'Detection',
  'LoginSession',
  'GGTT.Google_Tiktok_Setting',
  'GGTT.AppLogger'
];

focusTypes.forEach(tName => {
  console.log(`\n=================== ${tName} ===================`);
  for (const [tok, mName] of Object.entries(meta.methodMap)) {
    if (mName.startsWith(tName + '.')) {
      console.log(`  ${tok}: ${mName.replace(tName + '.', '')}`);
    }
  }
});
