import fs from 'fs';
import path from 'path';
import { Position, PieceType, isValidSquare, squareToAlgebraic } from '../src';

interface TestCase {
  id: string;
  requirementId: string;
  piece: PieceType;
  color: 'r' | 'b';
  description: string;
  fen: string;
  move: {
    from: number;
    to: number;
    fromAlgebraic: string;
    toAlgebraic: string;
  };
  expectedLegal: boolean;
  reason: string;
}

interface FixtureData {
  name: string;
  version: string;
  description: string;
  metadata: {
    totalTestCases: number;
    validCasesCount: number;
    invalidCasesCount: number;
    requirementsCovered: string[];
    piecesCovered: string[];
  };
  testCases: TestCase[];
}

describe('XQA-47: Chinese Chess Rules & MoveGen Fixtures', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'rules-movegen.fixture.json');
  let fixture: FixtureData;

  beforeAll(() => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const raw = fs.readFileSync(fixturePath, 'utf-8');
    fixture = JSON.parse(raw) as FixtureData;
  });

  describe('Acceptance Criteria 1: ≥50 Test Cases, 7 Piece Types, and Invalid Cases', () => {
    it('contains at least 50 test cases (AC: ≥50 TC)', () => {
      expect(fixture.testCases.length).toBeGreaterThanOrEqual(50);
      expect(fixture.metadata.totalTestCases).toBe(fixture.testCases.length);
    });

    it('covers all 7 piece types: King (k), Advisor (a), Elephant (b), Horse (n), Chariot (r), Cannon (c), Pawn (p)', () => {
      const requiredPieces: PieceType[] = ['k', 'a', 'b', 'n', 'r', 'c', 'p'];
      const presentPieces = new Set(fixture.testCases.map((tc) => tc.piece));

      for (const piece of requiredPieces) {
        expect(presentPieces.has(piece)).toBe(true);
      }
    });

    it('contains both legal and illegal move test cases for every piece type (AC: có ca không hợp lệ)', () => {
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

  describe('Acceptance Criteria 2: Requirement IDs Attached', () => {
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
  });

  describe('Acceptance Criteria 3: Fixture Data Integrity & FEN Validity', () => {
    it('every test case contains FEN, move coordinates (1D + algebraic), and expected outcome', () => {
      for (const tc of fixture.testCases) {
        expect(tc.id).toBeDefined();
        expect(tc.fen).toBeDefined();
        expect(typeof tc.expectedLegal).toBe('boolean');
        expect(tc.move).toBeDefined();
        expect(typeof tc.move.from).toBe('number');
        expect(typeof tc.move.to).toBe('number');
        expect(tc.move.fromAlgebraic).toBeDefined();
        expect(tc.move.toAlgebraic).toBeDefined();

        // Parse FEN with engine to ensure validity
        const pos = Position.fromFen(tc.fen);
        expect(pos).toBeDefined();
        expect(pos.sideToMove).toBe(tc.color);

        // Verify piece exists at 'from' square unless testing empty source square (TC-FR08-02)
        if (isValidSquare(tc.move.from) && tc.id !== 'TC-FR08-02') {
          const piece = pos.board[tc.move.from];
          expect(piece).not.toBeNull();
          expect(piece?.type).toBe(tc.piece);
          expect(squareToAlgebraic(tc.move.from)).toBe(tc.move.fromAlgebraic);
        }
      }
    });
  });

  describe('Engine Execution against Implemented Rules (FR-08, FR-11, FR-12, Điều 7.1b)', () => {
    it('correctly executes FR-08 boundary and basic constraints', () => {
      const fr08Cases = fixture.testCases.filter((tc) => tc.requirementId === 'FR-08');
      expect(fr08Cases.length).toBeGreaterThanOrEqual(6);

      for (const tc of fr08Cases) {
        const pos = Position.fromFen(tc.fen);
        expect(pos.isLegalMove(tc.move)).toBe(tc.expectedLegal);
      }
    });

    it('correctly executes FR-11 King (Tướng) pseudo-legal palace moves', () => {
      const kingCases = fixture.testCases.filter(
        (tc) => tc.requirementId === 'FR-11' && tc.piece === 'k',
      );
      expect(kingCases.length).toBeGreaterThanOrEqual(8);

      for (const tc of kingCases) {
        const pos = Position.fromFen(tc.fen);
        expect(pos.isLegalMove(tc.move)).toBe(tc.expectedLegal);
      }
    });

    it('correctly executes FR-11 Advisor (Sĩ) 5-point diagonal palace moves', () => {
      const advisorCases = fixture.testCases.filter(
        (tc) => tc.requirementId === 'FR-11' && tc.piece === 'a',
      );
      expect(advisorCases.length).toBeGreaterThanOrEqual(8);

      for (const tc of advisorCases) {
        const pos = Position.fromFen(tc.fen);
        expect(pos.isLegalMove(tc.move)).toBe(tc.expectedLegal);
      }
    });

    it('correctly executes FR-11 Elephant (Tượng) river and eye blocking moves', () => {
      const elephantCases = fixture.testCases.filter(
        (tc) => tc.requirementId === 'FR-11' && tc.piece === 'b',
      );
      expect(elephantCases.length).toBeGreaterThanOrEqual(8);

      for (const tc of elephantCases) {
        const pos = Position.fromFen(tc.fen);
        expect(pos.isLegalMove(tc.move)).toBe(tc.expectedLegal);
      }
    });

    it('correctly executes FR-12 Horse (Mã) L-steps and 4-direction leg blocking', () => {
      const horseCases = fixture.testCases.filter((tc) => tc.requirementId === 'FR-12');
      expect(horseCases.length).toBeGreaterThanOrEqual(10);

      for (const tc of horseCases) {
        const pos = Position.fromFen(tc.fen);
        expect(pos.isLegalMove(tc.move)).toBe(tc.expectedLegal);
      }
    });

    it('correctly executes Flying General capture (Điều 7.1b) when path is clear', () => {
      const fgCaptureCase = fixture.testCases.find((tc) => tc.id === 'TC-7.1B-01');
      expect(fgCaptureCase).toBeDefined();
      if (fgCaptureCase) {
        const pos = Position.fromFen(fgCaptureCase.fen);
        expect(pos.isLegalMove(fgCaptureCase.move)).toBe(true);
      }
    });
  });
});
