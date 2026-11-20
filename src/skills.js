'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');

function load(name) {
  if (!['agronomy', 'bookkeeping', 'fieldwork'].includes(name)) throw new Error('unknown_skill');
  const source = readFileSync(join(__dirname, '..', 'skills', name, 'SKILL.md'), 'utf8');
  const match = source.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]+)$/);
  if (!match || !match[1].split(/\r?\n/).includes('name: ' + name) || !match[2].trim()) throw new Error('invalid_skill');
  return { name, sha256: createHash('sha256').update(source).digest('hex'), text: match[2].trim() };
}

module.exports = { load };
