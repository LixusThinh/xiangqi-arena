import '@testing-library/jest-dom';

jest.mock('@/lib/ai/ai-client', () => ({
  createAiClient: () => ({
    computeMove: jest.fn().mockResolvedValue(null),
    terminate: jest.fn(),
  }),
}));
