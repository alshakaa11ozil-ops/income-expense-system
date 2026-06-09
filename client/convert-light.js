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
    
    // Backgrounds
    str = str.replace(/\bbg-slate-950\b/g, 'bg-slate-50');
    str = str.replace(/\bbg-slate-900\b/g, 'bg-white');
    str = str.replace(/\bbg-slate-800\b/g, 'bg-slate-100');
    str = str.replace(/\bbg-slate-700\b/g, 'bg-slate-200');
    str = str.replace(/\bhover:bg-slate-800\b/g, 'hover:bg-slate-200');
    str = str.replace(/\bhover:bg-slate-700\b/g, 'hover:bg-slate-300');
    
    // Borders
    str = str.replace(/\bborder-slate-800\b/g, 'border-slate-200');
    str = str.replace(/\bborder-slate-700\b/g, 'border-slate-300');
    
    // Text colors
    str = str.replace(/\btext-slate-200\b/g, 'text-slate-700');
    str = str.replace(/\btext-slate-300\b/g, 'text-slate-600');
    str = str.replace(/\btext-slate-400\b/g, 'text-slate-500');
    str = str.replace(/\btext-slate-500\b/g, 'text-slate-500'); 
    
    str = str.replace(/\bhover:text-slate-300\b/g, 'hover:text-slate-600');
    str = str.replace(/\bhover:text-slate-200\b/g, 'hover:text-slate-700');
    
    // Text white -> text dark, UNLESS there's a strong colored background
    const hasColoredBg = /\bbg-(?:emerald|indigo|red|blue|rose|amber|green|teal|purple|pink)-[45678]00\b/.test(str);
    if (!hasColoredBg) {
      str = str.replace(/\btext-white\b/g, 'text-slate-900');
      str = str.replace(/\bhover:text-white\b/g, 'hover:text-slate-900');
    }

    if (templateStr) return `className={\`${str}\`}`;
    return `className="${str}"`;
  });
  
  if (original !== content) {
    fs.writeFileSync(filePath, content);
  }
};

traverse('c:/Users/alsha/income-expense-system/client/src');
console.log('Done!');
