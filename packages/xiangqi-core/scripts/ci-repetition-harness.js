/**
 * Harness Điều 23 (XQA-96): chạy từng thế cờ trong tests/fixtures/dieu23.fixture.json qua RepetitionJudge,
 * báo pass/fail theo từng điểm của Điều 23. Thoát mã 1 nếu có ca active fail.
 * Cần build trước (dùng dist/). Báo cáo ghi ra reports/dieu23-harness-report.md (git-ignored)
 * và GitHub Step Summary nếu chạy trên Actions.
 */
const fs = require('fs');
const path = require('path');
const { Position, RepetitionJudge, algebraicToSquare } = require('../dist/index.js');

const fixturePath = path.join(__dirname, '..', 'tests', 'fixtures', 'dieu23.fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const mv = (u) => ({ from: algebraicToSquare(u.slice(0, 2)), to: algebraicToSquare(u.slice(2, 4)) });

function run(tc) {
  const judge = new RepetitionJudge(Position.fromFen(tc.fen));
  let verdict = null;
  for (let i = 0; i < tc.repeat; i++) {
    for (const m of tc.cycle) verdict = judge.play(mv(m));
  }
  const result = verdict && verdict.result;
  const ok =
    result !== null &&
    result.kind === tc.expect.kind &&
    (tc.expect.loser === undefined || result.loser === tc.expect.loser);
  return { ok, result };
}

const rows = [];
let pass = 0;
let fail = 0;
let pending = 0;
for (const tc of fixture.cases) {
  if (tc.status !== 'active') {
    pending++;
    rows.push({ ...tc, outcome: 'PENDING', actual: '-' });
    continue;
  }
  let outcome;
  let actual;
  try {
    const r = run(tc);
    outcome = r.ok ? 'PASS' : 'FAIL';
    actual = r.result ? `${r.result.kind}${r.result.loser ? ` (${r.result.loser} thua)` : ''}` : 'chưa xử';
  } catch (err) {
    outcome = 'FAIL';
    actual = `lỗi: ${err.message}`;
  }
  if (outcome === 'PASS') pass++;
  else fail++;
  rows.push({ ...tc, outcome, actual });
}

const expectText = (e) => `${e.kind}${e.loser ? ` (${e.loser} thua)` : ''}`;
const byPoint = fixture.points.map((point) => {
  const list = rows.filter((r) => r.point === point);
  const p = list.filter((r) => r.outcome === 'PASS').length;
  const f = list.filter((r) => r.outcome === 'FAIL').length;
  const golden = list.filter((r) => r.golden).length;
  const status = f > 0 ? 'FAIL' : p > 0 ? 'PASS' : 'CHƯA CÓ THẾ THẬT';
  return { point, pass: p, fail: f, golden, status, unitOnly: fixture.unitTestOnly[point] || '' };
});

console.log('='.repeat(70));
console.log('  XIANGQI ARENA - HARNESS ĐIỀU 23 (XQA-96)');
console.log('='.repeat(70));
for (const r of rows) {
  console.log(`[${r.outcome}] ${r.id} · ${r.point} · ${r.title} → mong đợi ${expectText(r.expect)}, thực tế ${r.actual}`);
}
console.log('-'.repeat(70));
console.table(byPoint.map(({ point, pass: p, fail: f, golden, status }) => ({ point, pass: p, fail: f, golden, status })));
const summary = `Active: ${pass}/${pass + fail} pass · Pending: ${pending} · Golden (hình Điều 24): ${rows.filter((r) => r.golden).length}`;
console.log(summary);

const report = `# Báo cáo harness Điều 23 (XQA-96)

- Ngày chạy: ${new Date().toISOString()}
- Fixture: \`packages/xiangqi-core/tests/fixtures/dieu23.fixture.json\`
- Kết quả: **${summary}**

## Theo từng điểm Điều 23

| Điểm | Pass | Fail | Golden | Trạng thái | Chỉ có unit test |
|---|---|---|---|---|---|
${byPoint.map((b) => `| ${b.point} | ${b.pass} | ${b.fail} | ${b.golden} | ${b.status} | ${b.unitOnly} |`).join('\n')}

## Từng ca

| ID | Điểm | Thế cờ | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${r.point} | ${r.title} | ${expectText(r.expect)} | ${r.actual} | ${r.outcome} |`).join('\n')}
`;
const reportsDir = path.join(__dirname, '..', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, 'dieu23-harness-report.md'), report, 'utf-8');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);

if (fail > 0) {
  console.error(`\n❌ ${fail} ca Điều 23 FAIL`);
  process.exit(1);
}
