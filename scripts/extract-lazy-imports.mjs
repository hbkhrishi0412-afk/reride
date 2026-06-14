import { execSync } from 'child_process';
import fs from 'fs';

const lines = execSync('git show HEAD:App.tsx', { encoding: 'utf8' }).split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('const Home = React.lazy'));
const end = lines.findIndex((l, i) => i > start && l.includes('const ChatWidget = React.lazy'));
if (start === -1 || end === -1) throw new Error('lazy block not found in HEAD App.tsx');

const block = lines
  .slice(start, end + 1)
  .join('\n')
  .replace(/import\('\.\/components\//g, "import('../")
  .replace(/import\('\.\/AdminLogin'\)/g, "import('../../AdminLogin')");

fs.writeFileSync('components/app/_lazy-imports.txt', block, 'utf8');
console.log('lazy imports:', start, end, block.length);
