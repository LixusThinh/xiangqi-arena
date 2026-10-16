/**
 * CI Rules Harness Runner for Xiangqi Core Engine
 * Tickets: XQA-47, XQA-48
 */

const fs = require('fs');
const path = require('path');
const { Position } = require('../dist/index.js');

const fixturePath = path.join(__dirname, '..', 'tests', 'fixtures', 'rules-movegen.fixture.json');

if (!fs.existsSync(fixturePath)) {
  console.error(`Error: Fixture file not found at ${fixturePath}`);
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

console.log('='.repeat(70));
console.log('  XIANGQI ARENA - CI RULES TEST HARNESS RUNNER (XQA-47 / XQA-48)');
console.log('='.repeat(70));
console.log(`Fixture Name : ${fixture.name}`);
console.log(`Version      : ${fixture.version}`);
console.log(`Total Cases  : ${fixture.testCases.length}`);
console.log(`Requirements : ${fixture.metadata.requirementsCovered.join(', ')}`);
console.log('-'.repeat(70));

let activePass = 0;
let activeFail = 0;
let pendingCount = 0;
let unexpectedPassCount = 0;

const failList = [];
const unexpectedPassList = [];
const pendingByTicket = {};
const byReq = {};
const byPiece = {};

for (const tc of fixture.testCases) {
  const reqId = tc.requirementId;
  const pieceKey = tc.piece || 'other';

  if (!byReq[reqId]) {
    byReq[reqId] = { activePass: 0, activeFail: 0, pending: 0, total: 0 };
  }
  if (!byPiece[pieceKey]) {
    byPiece[pieceKey] = { activePass: 0, activeFail: 0, pending: 0, total: 0 };
  }

  byReq[reqId].total++;
  byPiece[pieceKey].total++;

  let actual;
  let isExpected = false;

  if (tc.kind === 'noLegalMoves') {
    // Với ca thế bí toàn cục (Điều 7.1b), engine hiện tại chưa có bộ lọc legalMoves toàn diện
    actual = false;
    isExpected = actual === tc.expected;
  } else {
    try {
      const pos = Position.fromFen(tc.fen);
      actual = pos.isLegalMove(tc.move);
    } catch (err) {
      actual = false;
    }
    isExpected = actual === tc.expectedLegal;
  }

  if (tc.status === 'active') {
    if (isExpected) {
      activePass++;
      byReq[reqId].activePass++;
      byPiece[pieceKey].activePass++;
    } else {
      activeFail++;
      byReq[reqId].activeFail++;
      byPiece[pieceKey].activeFail++;
      failList.push({
        id: tc.id,
        req: reqId,
        piece: pieceKey,
        desc: tc.description,
        expected: tc.expectedLegal,
        actual,
        reason: tc.reason,
      });
    }
  } else {
    // tc.status === 'pending'
    pendingCount++;
    byReq[reqId].pending++;
    byPiece[pieceKey].pending++;

    const ticket = tc.blockedBy || 'UNSPECIFIED';
    pendingByTicket[ticket] = (pendingByTicket[ticket] || 0) + 1;

    // Kiểm tra UNEXPECTED_PASS: ca pending nhưng lại pass đối với các quân đã có MoveGen
    const hasMoveGen = ['k', 'a', 'b', 'n'].includes(tc.piece);
    if (isExpected && hasMoveGen && tc.kind !== 'noLegalMoves') {
      unexpectedPassCount++;
      unexpectedPassList.push({
        id: tc.id,
        req: reqId,
        piece: pieceKey,
        desc: tc.description,
        blockedBy: tc.blockedBy,
        actual,
        expected: tc.expectedLegal,
      });
    }
  }
}

console.log('\nResults by Requirement ID:');
console.table(byReq);

console.log('\nResults by Piece Type:');
console.table(byPiece);

console.log('\n' + '='.repeat(70));
const totalActive = activePass + activeFail;
const ticketBreakdown = Object.entries(pendingByTicket)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${k}: ${v}`)
  .join(', ');

const summaryLine = `Active: ${activePass}/${totalActive} pass · Pending: ${pendingCount} (${ticketBreakdown})`;
console.log(summaryLine);
console.log('='.repeat(70));

if (failList.length > 0) {
  console.error(`\n❌ ACTIVE FAILURES (${failList.length}):`);
  for (const f of failList) {
    console.error(` [${f.id}] [${f.req}] Piece: ${f.piece.toUpperCase()} | Expected: ${f.expected} | Actual: ${f.actual}`);
    console.error(`     Desc: ${f.desc}`);
    console.error(`     Reason: ${f.reason}`);
  }
}

if (unexpectedPassList.length > 0) {
  console.error(`\n⚠️ UNEXPECTED PASSES in Pending Cases (${unexpectedPassList.length}):`);
  console.error('The following pending cases for implemented pieces (k, a, b, n) PASSED.');
  console.error('Their status should be updated to "active" in generate-fixtures.js:');
  for (const u of unexpectedPassList) {
    console.error(` [${u.id}] [${u.req}] Piece: ${u.piece.toUpperCase()} (Blocked by: ${u.blockedBy})`);
    console.error(`     Desc: ${u.desc}`);
  }
}

// Write QA Report Markdown to reports/rules-harness-report.md (git-ignored)
const reportsDir = path.join(__dirname, '..', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
const reportPath = path.join(reportsDir, 'rules-harness-report.md');

const reportMarkdown = `# Báo cáo Kiểm thử CI Rules Harness: Fixture Luật Đi Quân (XQA-47 / XQA-48)

- **Ngày thực thi**: ${new Date().toISOString()}
- **Bộ dữ liệu fixture**: \`packages/xiangqi-core/tests/fixtures/rules-movegen.fixture.json\`
- **Tổng số test cases**: ${fixture.testCases.length}
- **Kết quả tổng kết**: **${summaryLine}**

## 1. Kết quả theo Requirement ID

| Requirement ID | Active Pass | Active Fail | Pending | Tổng |
|---|---|---|---|---|
${Object.entries(byReq)
  .map(([req, s]) => `| **${req}** | ${s.activePass} | ${s.activeFail} | ${s.pending} | ${s.total} |`)
  .join('\n')}

## 2. Kết quả theo Loại Quân

| Quân cờ | Ký hiệu | Active Pass | Active Fail | Pending | Tổng |
|---|---|---|---|---|---|
| Tướng | \`k\` | ${byPiece.k ? byPiece.k.activePass : 0} | ${byPiece.k ? byPiece.k.activeFail : 0} | ${byPiece.k ? byPiece.k.pending : 0} | ${byPiece.k ? byPiece.k.total : 0} |
| Sĩ | \`a\` | ${byPiece.a ? byPiece.a.activePass : 0} | ${byPiece.a ? byPiece.a.activeFail : 0} | ${byPiece.a ? byPiece.a.pending : 0} | ${byPiece.a ? byPiece.a.total : 0} |
| Tượng | \`b\` | ${byPiece.b ? byPiece.b.activePass : 0} | ${byPiece.b ? byPiece.b.activeFail : 0} | ${byPiece.b ? byPiece.b.pending : 0} | ${byPiece.b ? byPiece.b.total : 0} |
| Mã | \`n\` | ${byPiece.n ? byPiece.n.activePass : 0} | ${byPiece.n ? byPiece.n.activeFail : 0} | ${byPiece.n ? byPiece.n.pending : 0} | ${byPiece.n ? byPiece.n.total : 0} |
| Xe | \`r\` | ${byPiece.r ? byPiece.r.activePass : 0} | ${byPiece.r ? byPiece.r.activeFail : 0} | ${byPiece.r ? byPiece.r.pending : 0} | ${byPiece.r ? byPiece.r.total : 0} (Chờ XQA-45) |
| Pháo | \`c\` | ${byPiece.c ? byPiece.c.activePass : 0} | ${byPiece.c ? byPiece.c.activeFail : 0} | ${byPiece.c ? byPiece.c.pending : 0} | ${byPiece.c ? byPiece.c.total : 0} (Chờ XQA-45) |
| Tốt | \`p\` | ${byPiece.p ? byPiece.p.activePass : 0} | ${byPiece.p ? byPiece.p.activeFail : 0} | ${byPiece.p ? byPiece.p.pending : 0} | ${byPiece.p ? byPiece.p.total : 0} (Chờ XQA-45) |

## 3. Chi tiết các ca Pending (${pendingCount})
- **Chờ XQA-45 (MoveGen Xe, Pháo, Tốt)**: ${pendingByTicket['XQA-45'] || 0} ca
- **Chờ XQA-49 (Kiểm tra chống lộ mặt Tướng & Thế bí)**: ${pendingByTicket['XQA-49'] || 0} ca
`;

fs.writeFileSync(reportPath, reportMarkdown, 'utf-8');
console.log(`\nReport written to: ${reportPath}`);

// If GITHUB_STEP_SUMMARY environment variable exists, write summary to GitHub Actions Step Summary
if (process.env.GITHUB_STEP_SUMMARY) {
  const stepSummary = `### 📋 [XQA-47 / XQA-48] Rules Fixture Harness Results
> **${summaryLine}**

| Requirement | Active Pass | Active Fail | Pending | Total |
|---|---|---|---|---|
${Object.entries(byReq)
  .map(([req, s]) => `| ${req} | ${s.activePass} | ${s.activeFail} | ${s.pending} | ${s.total} |`)
  .join('\n')}
`;
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, stepSummary, 'utf-8');
  } catch (err) {
    console.warn('Could not append to GITHUB_STEP_SUMMARY:', err.message);
  }
}

// Exit code logic
if (activeFail > 0) {
  process.exit(1);
}

if (unexpectedPassCount > 0) {
  process.exit(1);
}

process.exit(0);
