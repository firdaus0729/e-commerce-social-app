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

function findStrings(file) {
  const src = fs.readFileSync(file, 'utf8');
  const regex = /<(?!ThemedText|Text|Link|MaterialIcons|IconSymbol|Image|View|Pressable|ScrollView|FlatList|KeyboardAvoidingView|SafeAreaView|Modal|StatusBar|ThemedView|Link|Stack.Screen|Stack)([A-Za-z0-9_$.\\-]+)[^>]*>\s*([^<\n][^<]*)/g;
  const matches = [];
  let m;
  while ((m = regex.exec(src))) {
    matches.push({ tag: m[1], text: m[2].trim(), index: m.index });
  }
  return matches;
}

const root = path.join(__dirname, '..');
const appDir = path.join(root, 'app');
if (!fs.existsSync(appDir)) {
  console.error('app directory not found:', appDir);
  process.exit(1);
}

const files = walk(appDir);
let found = false;
for (const f of files) {
  const matches = findStrings(f);
  if (matches.length) {
    found = true;
    console.log('\n' + f);
    for (const m of matches) {
      console.log('  tag <' + m.tag + '> contains text:', JSON.stringify(m.text).slice(0, 200));
    }
  }
}
if (!found) console.log('No suspicious raw JSX text found in app/ (heuristic).');
