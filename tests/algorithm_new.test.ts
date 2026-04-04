import { beforeEach, describe, expect, it, vi } from 'vitest';

const legacyParseMock = vi.fn();
const extractJsonLogsMock = vi.fn();
const getActivityLogsFromParsedJsonMock = vi.fn();
const getAlgorithmDataFromJsonMock = vi.fn();

vi.mock('../src/utils/algorithm.tsx', () => ({
  parseAlgorithmLogs: legacyParseMock,
}));

vi.mock('../src/utils/logParsingUtils.ts', () => ({
  extractJsonLogs: extractJsonLogsMock,
  getActivityLogsFromParsedJson: getActivityLogsFromParsedJsonMock,
  getAlgorithmDataFromJson: getAlgorithmDataFromJsonMock,
}));

describe('algorithm_new.parseAlgorithmLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to legacy parser and appends warning when JSON shape is missing', async () => {
    extractJsonLogsMock.mockReturnValue({ activitiesLog: '' });
    legacyParseMock.mockReturnValue({
      activityLogs: [],
      data: [],
    });

    const { parseAlgorithmLogs } = await import('../src/utils/algorithm_new.tsx');
    const parsed = parseAlgorithmLogs('legacy payload');

    expect(legacyParseMock).toHaveBeenCalledOnce();
    expect(parsed.source).toBe('legacy-format');
    expect(parsed.warnings).toEqual([
      'Legacy log format detected. Parsed with backward-compatible mode; some fields may differ from the current format.',
    ]);
  });

  it('preserves existing legacy warnings and appends format warning', async () => {
    extractJsonLogsMock.mockReturnValue({ activitiesLog: '' });
    legacyParseMock.mockReturnValue({
      activityLogs: [],
      data: [],
      warnings: ['existing warning'],
    });

    const { parseAlgorithmLogs } = await import('../src/utils/algorithm_new.tsx');
    const parsed = parseAlgorithmLogs('legacy payload');

    expect(parsed.warnings).toEqual([
      'existing warning',
      'Legacy log format detected. Parsed with backward-compatible mode; some fields may differ from the current format.',
    ]);
  });

  it('detects Prosperity submission when submissionId is present', async () => {
    extractJsonLogsMock.mockReturnValue({ activitiesLog: 'rows', logs: [{}], submissionId: 'abc-123' });
    getActivityLogsFromParsedJsonMock.mockReturnValue([
      {
        day: -1,
        timestamp: 0,
        product: 'TOMATOES',
        bidPrices: [4999],
        bidVolumes: [1],
        askPrices: [5001],
        askVolumes: [1],
        midPrice: 5000,
        profitLoss: 0,
      },
    ]);
    getAlgorithmDataFromJsonMock.mockReturnValue([
      {
        state: {
          timestamp: 0,
          traderData: '{}',
          listings: {},
          orderDepths: {},
          ownTrades: {},
          marketTrades: {},
          position: {},
          observations: {
            plainValueObservations: {},
            conversionObservations: {},
          },
        },
        orders: {},
        conversions: 0,
        traderData: '{}',
        algorithmLogs: '',
        sandboxLogs: '',
      },
    ]);

    const { parseAlgorithmLogs } = await import('../src/utils/algorithm_new.tsx');
    const parsed = parseAlgorithmLogs('json payload');

    expect(legacyParseMock).not.toHaveBeenCalled();
    expect(parsed.activityLogs).toHaveLength(1);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.source).toBe('prosperity-submission');
    expect(parsed.submissionId).toBe('abc-123');
    expect(parsed.warnings).toBeUndefined();
  });

  it('detects backtester log when submissionId is missing', async () => {
    extractJsonLogsMock.mockReturnValue({ activitiesLog: 'rows', logs: [{}] });
    getActivityLogsFromParsedJsonMock.mockReturnValue([
      {
        day: -1,
        timestamp: 0,
        product: 'TOMATOES',
        bidPrices: [4999],
        bidVolumes: [1],
        askPrices: [5001],
        askVolumes: [1],
        midPrice: 5000,
        profitLoss: 0,
      },
    ]);
    getAlgorithmDataFromJsonMock.mockReturnValue([
      {
        state: {
          timestamp: 0,
          traderData: '{}',
          listings: {},
          orderDepths: {},
          ownTrades: {},
          marketTrades: {},
          position: {},
          observations: {
            plainValueObservations: {},
            conversionObservations: {},
          },
        },
        orders: {},
        conversions: 0,
        traderData: '{}',
        algorithmLogs: '',
        sandboxLogs: '',
      },
    ]);

    const { parseAlgorithmLogs } = await import('../src/utils/algorithm_new.tsx');
    const parsed = parseAlgorithmLogs('json payload');

    expect(parsed.source).toBe('backtester');
    expect(parsed.submissionId).toBeUndefined();
  });
});
