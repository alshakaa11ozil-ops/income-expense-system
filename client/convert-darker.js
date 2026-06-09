import fs from 'fs';
import path from 'path';

const traverse = (dir) => {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      processFile(fullPath);
    }
  });
};

const processFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  const regex = /(?:className)=\{?`([^`]+)`\}?|(?:className)="([^"]+)"/g;

  content = content.replace(regex, (match, templateStr, quoteStr) => {
    let str = templateStr || quoteStr;
    
    // Shift backgrounds
    str = str.replace(/\bbg-slate-300\b/g, 'bg-slate-400');
    str = str.replace(/\bbg-slate-200\b/g, 'bg-slate-300');
    str = str.replace(/\bbg-slate-100\b/g, 'bg-slate-200');
    str = str.replace(/\bbg-slate-50\b/g, 'bg-slate-100');
    str = str.replace(/\bbg-white\b/g, 'bg-slate-50');
    
    // Shift hovers
    str = str.replace(/\bhover:bg-slate-300\b/g, 'hover:bg-slate-400');
    str = str.replace(/\bhover:bg-slate-200\b/g, 'hover:bg-slate-300');
    str = str.replace(/\bhover:bg-slate-100\b/g, 'hover:bg-slate-200');
    str = str.replace(/\bhover:bg-white\b/g, 'hover:bg-slate-50');

    // Shift borders to be visible on darker bg
    str = str.replace(/\bborder-slate-300\b/g, 'border-slate-400');
    str = str.replace(/\bborder-slate-200\b/g, 'border-slate-300');

    if (templateStr) return `className={\`${str}\`}`;
    return `className="${str}"`;
  });
  
  if (original !== content) {
    fs.writeFileSync(filePath, content);
  }
};

traverse('c:/Users/alsha/income-expense-system/client/src');
console.log('Done adjusting theme!');
