import { describe, expect, it } from 'vitest';
import type { ParsedJsonLogs } from '../src/models.ts';
import {
  extractJsonLogs,
  getActivityLogsFromParsedJson,
  getAlgorithmDataFromJson,
  parseLambdaLog,
  parseSandboxLog,
} from '../src/utils/logParsingUtils.ts';
import reducedPayloadFixture from './fixtures/42850_reduced.json';

const activityHeader =
  'day;timestamp;product;bid_price_1;bid_volume_1;bid_price_2;bid_volume_2;bid_price_3;bid_volume_3;ask_price_1;ask_volume_1;ask_price_2;ask_volume_2;ask_price_3;ask_volume_3;mid_price;profit_and_loss';

function buildCompressedLambdaRow(timestamp = 0): string {
  const compressed = [
    [timestamp, '{}', [['TOMATOES', 'TOMATOES', 1]], { TOMATOES: [{ 4999: 6 }, { 5013: -6 }] }, [], [], {}, [{}, {}]],
    [['TOMATOES', 5000, 10]],
    0,
    '{}',
    'algo log',
  ];

  return JSON.stringify(compressed);
}

function buildRichCompressedLambdaRow(timestamp = 0): string {
  const compressed = [
    [
      timestamp,
      '{"state":"input"}',
      [
        // listings
        ['TOMATOES', 'TOMATOES', 1],
        ['EMERALDS', 'EMERALDS', 'XIRECS'],
      ],
      {
        // orderDepths
        TOMATOES: [
          { 4999: 6, 4998: 3 },
          { 5001: -4, 5002: -2 },
        ], //
      },
      [['TOMATOES', 5000, 2, 'SUBMISSION', 'other', timestamp]], // ownTrades
      [['EMERALDS', 10000, 1, 'alice', 'bob', timestamp]], // marketTrades
      { TOMATOES: 12, EMERALDS: -3 }, // position
      [
        // observations
        { UV: 10 },
        {
          EMERALDS: [9998, 10002, 1, 2, 3, 4, 5],
        },
      ],
    ],
    [
      // orders
      ['TOMATOES', 5000, 10],
      ['EMERALDS', 10001, -7],
    ],
    2, // conversions
    '{"next":"state"}', // traderData
    'algo detailed log', // algorithmLogs
  ];

  return JSON.stringify(compressed);
}

function buildPayload(logs: ParsedJsonLogs['logs']): ParsedJsonLogs {
  const sampleActivityRow = [
    '-1',
    '0',
    'TOMATOES',
    '4999',
    '6',
    '',
    '',
    '',
    '',
    '5013',
    '6',
    '',
    '',
    '',
    '',
    '5006',
    '0',
  ].join(';');
  return {
    activitiesLog: `${activityHeader}\n${sampleActivityRow}\n`,
    logs,
  };
}

function loadReducedPayloadRaw(): string {
  return JSON.stringify(reducedPayloadFixture);
}

function loadReducedPayloadParsed(): ParsedJsonLogs {
  return reducedPayloadFixture as ParsedJsonLogs;
}

describe('extractJsonLogs', () => {
  it('returns parsed payload when activitiesLog is present', () => {
    const input = JSON.stringify({ activitiesLog: 'x', logs: [] });
    const parsed = extractJsonLogs(input);
    expect(parsed.activitiesLog).toBe('x');
  });

  it('returns empty fallback when input is invalid JSON', () => {
    const parsed = extractJsonLogs('not-json');
    expect(parsed.activitiesLog).toBe('');
    expect(parsed.logs).toBeUndefined();
  });
});

describe('getActivityLogsFromParsedJson', () => {
  it('parses rows from CSV and skips header/blank lines', () => {
    const parsed = buildPayload([]);
    const rows = getActivityLogsFromParsedJson(parsed);

    expect(rows).toHaveLength(1);
    expect(rows[0].timestamp).toBe(0);
    expect(rows[0].product).toBe('TOMATOES');
    expect(rows[0].bidPrices).toEqual([4999]);
    expect(rows[0].askPrices).toEqual([5013]);
  });
});

describe('real payload: 4285_reduced.json', () => {
  it('extractJsonLogs parses real payload and preserves activitiesLog', () => {
    const rawPayload = loadReducedPayloadRaw();
    const rawJson = JSON.parse(rawPayload) as ParsedJsonLogs;
    const parsed = extractJsonLogs(rawPayload);

    expect(parsed.activitiesLog.length).toBeGreaterThan(0);
    expect(parsed.activitiesLog).toBe(rawJson.activitiesLog);
    expect(Array.isArray(parsed.logs)).toBe(true);
    expect((parsed.logs ?? []).length).toBeGreaterThan(0);
  });

  it('getActivityLogsFromParsedJson returns all CSV data rows (header excluded)', () => {
    const parsed = loadReducedPayloadParsed();
    const expectedRowCount = parsed.activitiesLog.split(/\r?\n/).filter(line => line.trim().length > 0).length - 1;

    const rows = getActivityLogsFromParsedJson(parsed);
    expect(rows.length).toBe(expectedRowCount);
  });

  it('first two parsed rows match known TOMATOES/EMERALDS shape', () => {
    const parsed = loadReducedPayloadParsed();
    const rows = getActivityLogsFromParsedJson(parsed);

    expect(rows[0].day).toBe(-1);
    expect(rows[0].timestamp).toBe(0);
    expect(rows[0].product).toBe('TOMATOES');
    expect(rows[0].bidPrices[0]).toBe(4999);
    expect(rows[0].askPrices[0]).toBe(5013);

    expect(rows[1].day).toBe(-1);
    expect(rows[1].timestamp).toBe(0);
    expect(rows[1].product).toBe('EMERALDS');
    expect(rows[1].bidPrices[0]).toBe(9992);
    expect(rows[1].askPrices[0]).toBe(10008);
  });

  it('parsed rows keep bid/ask price-volume pairs aligned and numeric', () => {
    const parsed = loadReducedPayloadParsed();
    const rows = getActivityLogsFromParsedJson(parsed);

    for (const row of rows) {
      expect(Number.isFinite(row.day)).toBe(true);
      expect(Number.isFinite(row.timestamp)).toBe(true);
      expect(Number.isFinite(row.midPrice)).toBe(true);
      expect(Number.isFinite(row.profitLoss)).toBe(true);

      expect(row.bidPrices.length).toBe(row.bidVolumes.length);
      expect(row.askPrices.length).toBe(row.askVolumes.length);
    }
  });
});

describe('parseSandboxLog', () => {
  it('normalizes text and detects conversion requests', () => {
    const parsed = parseSandboxLog('  Conversion request: ORCHIDS x1  ');
    expect(parsed.text).toBe('Conversion request: ORCHIDS x1');
    expect(parsed.isConversionRequest).toBe(true);
  });

  it('handles undefined sandbox logs', () => {
    const parsed = parseSandboxLog(undefined);
    expect(parsed.text).toBe('');
    expect(parsed.isConversionRequest).toBe(false);
  });
});

describe('parseLambdaLog', () => {
  it('parses one compressed lambda payload', () => {
    const parsed = parseLambdaLog(buildCompressedLambdaRow(0));
    expect(parsed).not.toBeNull();
    expect(parsed?.state.timestamp).toBe(0);
    expect(parsed?.orders.TOMATOES[0].price).toBe(5000);
    expect(parsed?.state.listings.TOMATOES.denomination).toBe('1');
    expect(parsed?.algorithmLogs).toBe('algo log');
  });

  it('returns null for empty lambda payload', () => {
    expect(parseLambdaLog('')).toBeNull();
  });

  it('throws on malformed payload', () => {
    expect(() => parseLambdaLog('[[not-valid-json')).toThrow(/Invalid lambdaLog payload/);
  });

  it('decompresses positions, trades, order depths and observations', () => {
    const parsed = parseLambdaLog(buildRichCompressedLambdaRow(321));
    expect(parsed).not.toBeNull();

    expect(parsed?.state.position).toEqual({ TOMATOES: 12, EMERALDS: -3 });
    expect(parsed?.state.orderDepths.TOMATOES.buyOrders[4999]).toBe(6);
    expect(parsed?.state.orderDepths.TOMATOES.sellOrders[5001]).toBe(-4);

    expect(parsed?.state.ownTrades.TOMATOES).toHaveLength(1);
    expect(parsed?.state.ownTrades.TOMATOES[0].buyer).toBe('SUBMISSION');
    expect(parsed?.state.marketTrades.EMERALDS).toHaveLength(1);
    expect(parsed?.state.marketTrades.EMERALDS[0].seller).toBe('bob');

    expect(parsed?.state.observations.plainValueObservations.UV).toBe(10);
    expect(parsed?.state.observations.conversionObservations.EMERALDS.importTariff).toBe(3);
    expect(parsed?.state.listings.EMERALDS.denomination).toBe('XIRECS'); // FIXME: this is the denomination of the product, it should be a number in my opinion, to check

    expect(parsed?.orders.EMERALDS[0].quantity).toBe(-7);
    expect(parsed?.conversions).toBe(2);
    expect(parsed?.traderData).toBe('{"next":"state"}');
  });
});

describe('getAlgorithmDataFromJson', () => {
  it('builds rows using lambda and sandbox logs', () => {
    const parsed = buildPayload([
      { sandboxLog: 'hello sandbox', lambdaLog: buildCompressedLambdaRow(42), timestamp: 42 },
    ]);
    const rows = getAlgorithmDataFromJson(parsed);

    expect(rows).toHaveLength(1);
    expect(rows[0].state.timestamp).toBe(42);
    expect(rows[0].orders.TOMATOES[0].price).toBe(5000);
    expect(rows[0].sandboxLogs).toBe('hello sandbox');
  });

  it('appends conversion-request sandbox logs to previous row', () => {
    const parsed = buildPayload([
      { sandboxLog: 'first', lambdaLog: buildCompressedLambdaRow(0), timestamp: 0 },
      { sandboxLog: 'Conversion request: ORCHIDS x1', lambdaLog: '', timestamp: 100 },
    ]);
    const rows = getAlgorithmDataFromJson(parsed);

    expect(rows).toHaveLength(1);
    expect(rows[0].sandboxLogs).toContain('first');
    expect(rows[0].sandboxLogs).toContain('Conversion request: ORCHIDS x1');
  });

  it('ignores conversion request if there is no previous row', () => {
    const parsed = buildPayload([
      { sandboxLog: 'Conversion request: ORCHIDS x1', lambdaLog: '', timestamp: 0 },
      { sandboxLog: 'after', lambdaLog: buildCompressedLambdaRow(1), timestamp: 1 },
    ]);
    const rows = getAlgorithmDataFromJson(parsed);

    expect(rows).toHaveLength(1);
    expect(rows[0].sandboxLogs).toBe('after');
  });

  it('returns empty when logs array is missing', () => {
    const rows = getAlgorithmDataFromJson({ activitiesLog: '' });
    expect(rows).toEqual([]);
  });

  it('throws when a lambda row is malformed', () => {
    const parsed = buildPayload([{ sandboxLog: 'x', lambdaLog: '[[not-valid-json', timestamp: 0 }]);
    expect(() => getAlgorithmDataFromJson(parsed)).toThrow(/Invalid lambdaLog payload/);
  });
});
