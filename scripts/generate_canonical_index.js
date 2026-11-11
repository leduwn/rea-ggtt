const fs = require('fs');

const meta = JSON.parse(fs.readFileSync('evidence/verified/metadata_index.json', 'utf8').replace(/^﻿/, ''));

// Group types and methods by namespace / subsystem
const namespaces = {};
for (const [token, typeName] of Object.entries(meta.typeMap)) {
  let ns = 'Global';
  if (typeName.includes('.')) {
    const parts = typeName.split('.');
    parts.pop();
    ns = parts.join('.');
  } else if (typeName.startsWith('<>')) {
    ns = 'CompilerGenerated';
  }
  if (!namespaces[ns]) {
    namespaces[ns] = {
      types: [],
      methods: [],
      fields: []
    };
  }
  namespaces[ns].types.push({ token, name: typeName });
}

for (const [token, methodFullName] of Object.entries(meta.methodMap)) {
  let ns = 'Global';
  if (methodFullName.includes('.')) {
    const parts = methodFullName.split('.');
    parts.pop(); // remove method name
    const typeName = parts.join('.');
    if (typeName.includes('.')) {
      const nsParts = typeName.split('.');
      nsParts.pop();
      ns = nsParts.join('.');
    } else if (typeName.startsWith('<>')) {
      ns = 'CompilerGenerated';
    } else {
      ns = typeName;
    }
  } else if (methodFullName.startsWith('<>')) {
    ns = 'CompilerGenerated';
  }
  if (!namespaces[ns]) {
    namespaces[ns] = { types: [], methods: [], fields: [] };
  }
  namespaces[ns].methods.push({ token, name: methodFullName });
}

console.log('Detected Namespaces / Groups:');
const summary = Object.keys(namespaces).map(ns => ({
  namespace: ns,
  typesCount: namespaces[ns].types.length,
  methodsCount: namespaces[ns].methods.length
})).sort((a, b) => b.methodsCount - a.methodsCount);

console.table(summary);
