const fs = require('fs');
const lines = fs.readFileSync('js/diagnosis.js', 'utf8').split(/\n/);
let d = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const ch of line) {
    if (ch === '{') d++;
    if (ch === '}') d--;
  }
  const n = i + 1;
  if (n >= 645 && n <= 670) console.log(n + ' d=' + d + ' | ' + line.slice(0, 70));
  if (n === 1565 || n === 1568) console.log('>>> ' + n + ' depth=' + d);
}
console.log('final depth', d);
