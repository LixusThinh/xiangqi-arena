import fs from 'fs';
import path from 'path';
import { Position, PieceType, isValidSquare, squareToAlgebraic } from '../src';

interface TestCase {
  id: string;
  kind?: 'noLegalMoves' | 'move';
  requirementId: string;
  piece?: PieceType;
  color: 'r' | 'b';
  description: string;
  fen: string;
  emptySource?: boolean;
  move?: {
    from: number;
    to: number;
    fromAlgebraic: string;
    toAlgebraic: string;
  };
  expectedLegal?: boolean;
  expected?: boolean;
  status: 'active' | 'pending';
  blockedBy: 'XQA-45' | 'XQA-49' | null;
  reason: string;
}

interface FixtureData {
  name: string;
  version: string;
  description: string;
  metadata: {
    totalTestCases: number;
    activeCount: number;
    pendingCount: number;
    validCasesCount: number;
    invalidCasesCount: number;
    requirementsCovered: string[];
    piecesCovered: string[];
  };
  testCases: TestCase[];
}

const fixturePath = path.join(__dirname, 'fixtures', 'rules-movegen.fixture.json');
const rawFixture = fs.readFileSync(fixturePath, 'utf-8');
const fixture = JSON.parse(rawFixture) as FixtureData;

const activeCases = fixture.testCases.filter((tc) => tc.status === 'active');
const pendingCases = fixture.testCases.filter((tc) => tc.status === 'pending');

describe('XQA-47: Chinese Chess Rules & MoveGen Fixtures', () => {
  describe('Acceptance Criteria 1: ≥50 Test Cases, 7 Piece Types, and Invalid Cases', () => {
    it('contains at least 50 test cases (AC: ≥50 TC)', () => {
      expect(fixture.testCases.length).toBeGreaterThanOrEqual(50);
      expect(fixture.metadata.totalTestCases).toBe(fixture.testCases.length);
    });

    it('covers all 7 piece types: King (k), Advisor (a), Elephant (b), Horse (n), Chariot (r), Cannon (c), Pawn (p)', () => {
      const requiredPieces: PieceType[] = ['k', 'a', 'b', 'n', 'r', 'c', 'p'];
      const presentPieces = new Set(
        fixture.testCases.map((tc) => tc.piece).filter((p): p is PieceType => !!p),
      );

      for (const piece of requiredPieces) {
        expect(presentPieces.has(piece)).toBe(true);
      }
    });

    it('contains both legal and illegal move test cases for every piece type', () => {
      const pieces: PieceType[] = ['k', 'a', 'b', 'n', 'r', 'c', 'p'];

      for (const piece of pieces) {
        const pieceCases = fixture.testCases.filter((tc) => tc.piece === piece);
        const hasValid = pieceCases.some((tc) => tc.expectedLegal === true);
        const hasInvalid = pieceCases.some((tc) => tc.expectedLegal === false);

        expect(hasValid).toBe(true);
        expect(hasInvalid).toBe(true);
      }
    });
  });

  describe('Acceptance Criteria 2: Requirement IDs & Pending Status Integrity', () => {
    it('associates every test case with a recognized Requirement ID (FR-08, FR-11, FR-12, FR-13, Điều 7.1b)', () => {
      const allowedReqs = new Set(['FR-08', 'FR-11', 'FR-12', 'FR-13', 'Điều 7.1b']);

      for (const tc of fixture.testCases) {
        expect(allowedReqs.has(tc.requirementId)).toBe(true);
      }
    });

    it('covers all specified requirement IDs across the fixture suite', () => {
      const presentReqs = new Set(fixture.testCases.map((tc) => tc.requirementId));
      expect(presentReqs.has('FR-08')).toBe(true);
      expect(presentReqs.has('FR-11')).toBe(true);
      expect(presentReqs.has('FR-12')).toBe(true);
      expect(presentReqs.has('FR-13')).toBe(true);
      expect(presentReqs.has('Điều 7.1b')).toBe(true);
    });

    it('covers Điều 7.1b through genuine stalemate (noLegalMoves) test cases', () => {
      const stalemateCases = fixture.testCases.filter((tc) => tc.kind === 'noLegalMoves');
      expect(stalemateCases.length).toBeGreaterThanOrEqual(2);
      for (const tc of stalemateCases) {
        expect(tc.requirementId).toBe('Điều 7.1b');
        expect(tc.expected).toBe(true);
      }
    });

    it('ensures every pending test case has a non-null blockedBy ticket identifier', () => {
      expect(pendingCases.length).toBeGreaterThan(0);
      for (const tc of pendingCases) {
        expect(tc.blockedBy).not.toBeNull();
        expect(['XQA-45', 'XQA-49']).toContain(tc.blockedBy);
      }
    });
  });

  describe('Acceptance Criteria 3: Fixture Data Integrity & FEN Validity', () => {
    it('every test case contains FEN and valid structure', () => {
      for (const tc of fixture.testCases) {
        expect(tc.id).toBeDefined();
        expect(tc.fen).toBeDefined();
        expect(tc.status).toBeDefined();

        const pos = Position.fromFen(tc.fen);
        expect(pos).toBeDefined();
        expect(pos.sideToMove).toBe(tc.color);

        if (tc.move) {
          expect(typeof tc.move.from).toBe('number');
          expect(typeof tc.move.to).toBe('number');
          expect(tc.move.fromAlgebraic).toBeDefined();
          expect(tc.move.toAlgebraic).toBeDefined();

          if (isValidSquare(tc.move.from) && !tc.emptySource) {
            const piece = pos.board[tc.move.from];
            expect(piece).not.toBeNull();
            expect(piece?.type).toBe(tc.piece);
            expect(squareToAlgebraic(tc.move.from)).toBe(tc.move.fromAlgebraic);
          }
        }
      }
    });
  });

  // AC1 of XQA-48: Per-TC execution in Jest
  describe('Active Rule Test Cases (Engine Verification)', () => {
    it.each(activeCases)(
      '$id [$requirementId] $description',
      (tc) => {
        const pos = Position.fromFen(tc.fen);
        expect(pos.isLegalMove(tc.move!)).toBe(tc.expectedLegal);
      },
    );
  });

  describe('Pending Rule Test Cases (Skipped on CI until feature tickets merge)', () => {
    it.skip.each(pendingCases)(
      '[PENDING $blockedBy] $id [$requirementId] $description',
      () => {
        // Skipped
      },
    );
  });
});
