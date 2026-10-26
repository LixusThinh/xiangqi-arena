/**
 * Benchmark tự đấu giữa 2 mức AI (XQA-100, Story XQA-28 AC2: "mức Khó thắng mức Dễ ≥ 70% trên 20 ván").
 *
 * Chạy (sau khi build core):
 *   node scripts/ai-benchmark.js [--games 20] [--a HARD] [--b EASY] [--seed 2026] [--max-plies 300] [--out report.json]
 *                                [--min-win-rate 0.7]   ← thoát mã 1 nếu tỷ lệ thắng của A dưới ngưỡng (dùng được trong CI)
 *
 * Luật kết thúc ván trong benchmark:
 * - Hết nước hợp lệ (chiếu bí hoặc hết nước, Điều 7.1) → bên tới lượt thua. Lấy từ Position.getGameStatus().
 * - Thế cờ lặp lại lần thứ 3 → tính HÒA. Benchmark chưa áp Điều 23 (chiếu dai / bắt dai xử thua); tính hòa là
 *   chặt hơn cho mức mạnh, vì một ván mức mạnh lẽ ra thắng theo Điều 23 sẽ bị tính hòa.
 * - Quá --max-plies nửa nước → HÒA.
 * Mức A cầm Đỏ ở ván lẻ, cầm Đen ở ván chẵn. Mỗi ván dùng seed riêng (seed + số ván) cho cả hai bên.
 */

const fs = require('fs');
const { Position, chooseAiMove, createRng, AI_LEVELS } = require('../dist/index.js');

function parseArgs(argv) {
  const args = { games: 20, a: 'HARD', b: 'EASY', seed: 2026, maxPlies: 300, out: null, minWinRate: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--games') args.games = Number(value);
    else if (key === '--a') args.a = value;
    else if (key === '--b') args.b = value;
    else if (key === '--seed') args.seed = Number(value);
    else if (key === '--max-plies') args.maxPlies = Number(value);
    else if (key === '--out') args.out = value;
    else if (key === '--min-win-rate') args.minWinRate = Number(value);
    else throw new Error(`Unknown argument: ${key}`);
  }
  for (const level of [args.a, args.b]) {
    if (!AI_LEVELS[level]) throw new Error(`Unknown level ${level}; use EASY | MEDIUM | HARD`);
  }
  return args;
}

function playGame({ red, black, seed, maxPlies, timing }) {
  const pos = Position.initial();
  const rng = createRng(seed);
  const seen = new Map([[pos.toHashString(), 1]]);
  for (let ply = 0; ply < maxPlies; ply++) {
    const status = pos.getGameStatus();
    if (status.result) return { winner: status.result.winner, reason: status.result.reason, plies: ply };
    const level = pos.sideToMove === 'r' ? red : black;
    const t0 = process.hrtime.bigint();
    const { move, timedOut } = chooseAiMove(pos, level, { rng });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    timing[level].moves++;
    timing[level].totalMs += ms;
    timing[level].maxMs = Math.max(timing[level].maxMs, ms);
    if (timedOut) timing[level].timeouts++;
    if (!pos.isLegalMove(move)) throw new Error(`Illegal move from ${level} at ply ${ply}`);
    pos.applyMove(move);
    const hash = pos.toHashString();
    const count = (seen.get(hash) || 0) + 1;
    seen.set(hash, count);
    if (count >= 3) return { winner: null, reason: 'repetition', plies: ply + 1 };
  }
  const status = pos.getGameStatus();
  if (status.result) return { winner: status.result.winner, reason: status.result.reason, plies: maxPlies };
  return { winner: null, reason: 'max_plies', plies: maxPlies };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const timing = {};
  for (const level of new Set([args.a, args.b])) timing[level] = { moves: 0, totalMs: 0, maxMs: 0, timeouts: 0 };
  const games = [];
  const started = Date.now();
  for (let i = 1; i <= args.games; i++) {
    const aIsRed = i % 2 === 1;
    const red = aIsRed ? args.a : args.b;
    const black = aIsRed ? args.b : args.a;
    const seed = args.seed + i;
    const r = playGame({ red, black, seed, maxPlies: args.maxPlies, timing });
    const aColor = aIsRed ? 'r' : 'b';
    const outcome = r.winner === null ? 'draw' : r.winner === aColor ? 'A' : 'B';
    games.push({ game: i, seed, red, black, ...r, outcome });
    const who = outcome === 'draw' ? 'HÒA' : outcome === 'A' ? `${args.a} thắng` : `${args.b} thắng`;
    console.log(`Ván ${String(i).padStart(2)}: Đỏ=${red.padEnd(6)} Đen=${black.padEnd(6)} → ${who.padEnd(12)} (${r.reason}, ${r.plies} nửa nước)`);
  }
  const winsA = games.filter((g) => g.outcome === 'A').length;
  const winsB = games.filter((g) => g.outcome === 'B').length;
  const draws = games.length - winsA - winsB;
  const summary = {
    a: args.a,
    b: args.b,
    levels: { [args.a]: AI_LEVELS[args.a], [args.b]: AI_LEVELS[args.b] },
    games: args.games,
    seed: args.seed,
    maxPlies: args.maxPlies,
    winsA,
    winsB,
    draws,
    winRateA: winsA / games.length,
    timing: Object.fromEntries(
      Object.entries(timing).map(([level, t]) => [
        level,
        { moves: t.moves, avgMs: +(t.totalMs / Math.max(1, t.moves)).toFixed(1), maxMs: +t.maxMs.toFixed(1), timeouts: t.timeouts },
      ]),
    ),
    totalSeconds: +((Date.now() - started) / 1000).toFixed(1),
    node: process.version,
    results: games,
  };
  console.log('-'.repeat(70));
  console.log(`${args.a} thắng ${winsA} · ${args.b} thắng ${winsB} · hòa ${draws} → tỷ lệ thắng ${args.a} = ${(100 * summary.winRateA).toFixed(0)}%`);
  for (const [level, t] of Object.entries(summary.timing)) {
    console.log(`${level}: ${t.moves} nước, TB ${t.avgMs} ms/nước, chậm nhất ${t.maxMs} ms, quá giờ ${t.timeouts}`);
  }
  console.log(`Tổng thời gian: ${summary.totalSeconds} s`);
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(summary, null, 2));
  if (args.minWinRate !== null) {
    const ok = summary.winRateA >= args.minWinRate;
    console.log(`Ngưỡng ${args.a} ≥ ${(100 * args.minWinRate).toFixed(0)}%: ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
    if (!ok) process.exitCode = 1;
  }
}

main();
