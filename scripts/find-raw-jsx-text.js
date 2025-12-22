const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) files.push(...walk(p));
    else if (p.endsWith('.tsx') || p.endsWith('.jsx')) files.push(p);
  }
  return files;
}

function stripTextBlocks(src) {
  // remove Text and ThemedText contents to avoid false positives
  return src
    .replace(/<Text[\s\S]*?<\/Text>/g, '<Text></Text>')
    .replace(/<ThemedText[\s\S]*?<\/ThemedText>/g, '<ThemedText></ThemedText>');
}

function findRawText(file) {
  const src = fs.readFileSync(file, 'utf8');
  const stripped = stripTextBlocks(src);
  const regex = />\s*([^<\n\r][^<]*)/g;
  const matches = [];
  let m;
  while ((m = regex.exec(stripped))) {
    const text = m[1].trim();
    // ignore JSX expressions like {something}
    if (!text) continue;
    if (text.startsWith('{')) continue;
    // ignore lines that are likely code (contain = or => or function keywords)
    if (/[=;:{}=>]/.test(text)) continue;
    // ignore single punctuation
    if (/^[(){}\[\]\\/<>]$/.test(text)) continue;
    matches.push({ index: m.index, text });
  }
  return matches;
}

const appDir = path.join(__dirname, '..', 'app');
const files = walk(appDir);
let found = false;
for (const f of files) {
  const matches = findRawText(f);
  if (matches.length) {
    found = true;
    console.log('\n' + f);
    for (const m of matches) console.log('  raw text:', JSON.stringify(m.text).slice(0, 200));
  }
}
if (!found) console.log('No raw JSX text nodes found outside Text/ThemedText (heuristic).');
