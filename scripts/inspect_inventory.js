const fs = require('fs');

const meta = JSON.parse(fs.readFileSync('evidence/verified/metadata_index.json', 'utf8').replace(/^﻿/, ''));

console.log('Sample typeMap entry:');
const firstTypeKey = Object.keys(meta.typeMap)[0];
console.log(firstTypeKey, '=>', meta.typeMap[firstTypeKey]);

console.log('\nSample methodMap entry:');
const firstMethodKey = Object.keys(meta.methodMap)[0];
console.log(firstMethodKey, '=>', meta.methodMap[firstMethodKey]);

console.log('\nCheck target tokens in methodMap:');
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
targetTokens.forEach(t => {
  console.log(t, '=>', meta.methodMap[t]);
});

console.log('\nSample fieldMap entry:');
const firstFieldKey = Object.keys(meta.fieldMap)[0];
console.log(firstFieldKey, '=>', meta.fieldMap[firstFieldKey]);

console.log('\nSample stringMap entry:');
const firstStringKey = Object.keys(meta.stringMap)[0];
console.log(firstStringKey, '=>', meta.stringMap[firstStringKey]);
