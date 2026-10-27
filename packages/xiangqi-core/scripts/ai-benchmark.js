/**
 * Benchmark tự đấu giữa các mức độ khó của AI (XQA-100, story XQA-28).
 *
 * Cách chạy (cần build trước vì script đọc từ dist):
 *   pnpm --filter @xiangqi-arena/xiangqi-core build
 *   pnpm --filter @xiangqi-arena/xiangqi-core ai:benchmark -- --md ../../docs/engine/ai-levels.md
 *
 * Tham số:
 *   --games N        số ván mỗi cặp, mặc định 20 (nên chẵn để chia đều màu)
 *   --match a:b,...  các cặp "mạnh:yếu", mặc định hard:easy,hard:medium,medium:easy
 *   --seed S         seed gốc, mặc định 2026
 *   --md FILE        ghi báo cáo markdown vào FILE (nếu không có thì chỉ in ra màn hình)
 *
 * Quy ước: mỗi cặp chia đều màu; hai ván cùng cặp (Đỏ/Đen đổi chỗ) dùng cùng seed nên cùng khai cuộc.
 * Tỉ lệ thắng = số ván thắng / tổng số ván (hòa KHÔNG tính là thắng) – đúng cách đọc AC "thắng ≥ 70% trên 20 ván".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AI_LEVELS, isAiLevel, playSelfPlayGame } = require('../dist/index.js');

function parseArgs(argv) {
  const args = { games: 20, match: 'hard:easy,hard:medium,medium:easy', seed: 2026, md: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--games') args.games = Number(value);
    else if (key === '--match') args.match = value;
    else if (key === '--seed') args.seed = Number(value);
    else if (key === '--md') args.md = value;
    else continue;
    i++;
  }
  if (!Number.isInteger(args.games) || args.games < 2) throw new Error('--games phải là số nguyên >= 2');
  if (!Number.isInteger(args.seed)) throw new Error('--seed phải là số nguyên');
  return args;
}

function parseMatches(text) {
  return text.split(',').map((pair) => {
    const [strong, weak] = pair.split(':');
    if (!isAiLevel(strong) || !isAiLevel(weak)) {
      throw new Error(`Cặp "${pair}" không hợp lệ; dùng dạng mạnh:yếu với easy|medium|hard`);
    }
    return { strong, weak };
  });
}

function runMatch({ strong, weak }, games, baseSeed) {
  const rows = [];
  for (let g = 0; g < games; g++) {
    const strongIsRed = g % 2 === 0;
    const seed = baseSeed + Math.floor(g / 2);
    const result = playSelfPlayGame({
      red: strongIsRed ? strong : weak,
      black: strongIsRed ? weak : strong,
      seed,
    });
    const strongSide = strongIsRed ? 'r' : 'b';
    const weakSide = strongIsRed ? 'b' : 'r';
    rows.push({
      game: g + 1,
      seed,
      strongColor: strongIsRed ? 'Đỏ' : 'Đen',
      outcome: result.winner === null ? 'hòa' : result.winner === strongSide ? 'mạnh thắng' : 'yếu thắng',
      reason: result.reason,
      plies: result.plies,
      strongMs: result.aiMoves[strongSide] ? result.thinkMs[strongSide] / result.aiMoves[strongSide] : 0,
      weakMs: result.aiMoves[weakSide] ? result.thinkMs[weakSide] / result.aiMoves[weakSide] : 0,
      strongTimeouts: result.timeouts[strongSide],
      weakTimeouts: result.timeouts[weakSide],
    });
  }
  const wins = rows.filter((r) => r.outcome === 'mạnh thắng').length;
  const losses = rows.filter((r) => r.outcome === 'yếu thắng').length;
  const draws = rows.length - wins - losses;
  const avg = (key) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
  return {
    strong,
    weak,
    rows,
    wins,
    losses,
    draws,
    winRate: wins / games,
    avgPlies: avg('plies'),
    strongMs: avg('strongMs'),
    weakMs: avg('weakMs'),
    maxStrongMs: Math.max(...rows.map((r) => r.strongMs)),
    timeouts: rows.reduce((sum, r) => sum + r.strongTimeouts + r.weakTimeouts, 0),
  };
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;
const label = (m) => `${m.strong} vs ${m.weak}`;

function render(args, results) {
  const lines = [];
  lines.push('# Benchmark tự đấu 3 mức độ khó AI (XQA-100)');
  lines.push('');
  lines.push(
    '> Tạo tự động bởi `packages/xiangqi-core/scripts/ai-benchmark.js`, không sửa tay. ' +
      'Chạy lại bằng lệnh ở đầu file script; cùng seed + cùng cấu hình cho cùng kết quả về mặt nước đi (thời gian ms phụ thuộc máy).',
  );
  lines.push('');
  lines.push('## Điều kiện chạy');
  lines.push('');
  lines.push(`- Số ván mỗi cặp: ${args.games}, chia đều màu (cùng seed cho hai ván đổi màu). Seed gốc: ${args.seed}.`);
  lines.push('- Khai cuộc: 4 nửa nước đầu đi ngẫu nhiên có seed (cả hai bên), sau đó AI tự chọn nước.');
  lines.push(
    '- Kết thúc ván: hết nước hợp lệ (Điều 7.1) hoặc RepetitionJudge xử (Điều 23); trần 240 nửa nước tính hòa ' +
      '(trần này là quy ước của benchmark, KHÔNG phải luật cờ).',
  );
  lines.push(`- Máy chạy: Node ${process.version}, ${os.cpus()[0].model}, ${os.cpus().length} luồng.`);
  lines.push('');
  lines.push('| Mức | Độ sâu | Trần thời gian / nước | Nhiễu |');
  lines.push('|---|---|---|---|');
  for (const [name, c] of Object.entries(AI_LEVELS)) {
    lines.push(`| ${name} | ${c.depth} | ${c.maxTimeMs} ms | ${c.noise} |`);
  }
  lines.push('');
  lines.push('## Kết quả');
  lines.push('');
  lines.push('| Cặp (mạnh vs yếu) | Mạnh thắng | Yếu thắng | Hòa | Tỉ lệ thắng của bên mạnh | Số nửa nước TB | ms/nước bên mạnh (TB / tối đa theo ván) | ms/nước bên yếu (TB) | Số lần bị cắt giờ |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const m of results) {
    lines.push(
      `| ${label(m)} | ${m.wins} | ${m.losses} | ${m.draws} | **${pct(m.winRate)}** (${m.wins}/${args.games}) | ` +
        `${m.avgPlies.toFixed(0)} | ${m.strongMs.toFixed(0)} / ${m.maxStrongMs.toFixed(0)} | ${m.weakMs.toFixed(0)} | ${m.timeouts} |`,
    );
  }
  const ac = results.find((m) => m.strong === 'hard' && m.weak === 'easy');
  if (ac) {
    lines.push('');
    lines.push('## Đối chiếu Acceptance Criteria (XQA-100 / XQA-28)');
    lines.push('');
    const ok = ac.winRate >= 0.7 && args.games >= 20;
    lines.push(
      `- AC: Khó thắng Dễ ≥ 70% trên 20 ván → **${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}** ` +
        `(${ac.wins}/${args.games} = ${pct(ac.winRate)}${args.games < 20 ? ', chưa đủ 20 ván' : ''}).`,
    );
  }
  for (const m of results) {
    lines.push('');
    lines.push(`## Chi tiết từng ván: ${label(m)}`);
    lines.push('');
    lines.push('| Ván | Seed | Bên mạnh cầm | Kết quả | Lý do kết thúc | Số nửa nước | ms/nước mạnh | ms/nước yếu |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const r of m.rows) {
      lines.push(
        `| ${r.game} | ${r.seed} | ${r.strongColor} | ${r.outcome} | ${r.reason} | ${r.plies} | ${r.strongMs.toFixed(0)} | ${r.weakMs.toFixed(0)} |`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const results = parseMatches(args.match).map((pair) => runMatch(pair, args.games, args.seed));
const report = render(args, results);
console.log(report);
if (args.md) {
  const target = path.resolve(process.cwd(), args.md);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, report, 'utf8');
  console.error(`\nĐã ghi báo cáo: ${target}`);
}
