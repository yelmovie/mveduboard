const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = path.join(root, 'src', 'utils', 'uuid.ts');
const exts = new Set(['.ts', '.tsx']);
const files = [];

const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (exts.has(path.extname(p))) files.push(p);
  }
};

walk(root);

for (const file of files) {
  if (file === target) continue;
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('crypto.randomUUID')) continue;

  const replaced = content.replace(/crypto\.randomUUID\(\)/g, 'generateUUID()');
  if (replaced === content) continue;
  content = replaced;

  const hasImport = /generateUUID/.test(content) && /from\s+['"].*uuid['"]/.test(content);
  if (!hasImport) {
    const rel = path
      .relative(path.dirname(file), target)
      .replace(/\\/g, '/')
      .replace(/\.ts$/, '');
    const importLine = `import { generateUUID } from '${rel}';`;
    const lines = content.split(/\r?\n/);
    let lastImport = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
    } else {
      lines.unshift(importLine);
    }
    content = lines.join('\n');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('updated', path.relative(root, file));
}
