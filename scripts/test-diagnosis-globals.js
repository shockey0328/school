const fs = require('fs');
const vm = require('vm');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../js/diagnosis.js'), 'utf8');
const ctx = { window: {}, document: { getElementById: () => null, querySelectorAll: () => [] }, console };
ctx.addEventListener = () => {};
ctx.window = ctx;
vm.createContext(ctx);
try {
  vm.runInContext(code, ctx);
} catch (e) {
  console.error('LOAD FAIL:', e.message);
  process.exit(1);
}
const need = [
  'renderPaperAnalysis',
  'resetHomeworkPanelState',
  'onClassChange',
  'onGradeChange',
  'switchMainTab',
  'renderAll',
  'changeHomeworkListPage',
];
need.forEach((n) => {
  const t = typeof ctx[n];
  const wt = typeof ctx.window[n];
  if (t !== 'function') console.log('MISSING global', n, t);
  if (wt !== 'function' && ['renderPaperAnalysis', 'changeHomeworkListPage'].includes(n)) {
    console.log('MISSING window', n, wt);
  }
});
console.log('ok');
