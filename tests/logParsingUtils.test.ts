import { describe, expect, it } from 'vitest';
import type { ParsedJsonLogs } from '../src/models.ts';
import { extractJsonLogs, getActivityLogsFromParsedJson } from '../src/utils/logParsingUtils.ts';
import reducedPayloadFixture from './fixtures/42850_reduced.json';


const activityHeader =
  'day;timestamp;product;bid_price_1;bid_volume_1;bid_price_2;bid_volume_2;bid_price_3;bid_volume_3;ask_price_1;ask_volume_1;ask_price_2;ask_volume_2;ask_price_3;ask_volume_3;mid_price;profit_and_loss';


function buildPayload(logs: ParsedJsonLogs['logs']): ParsedJsonLogs {
  const sampleActivityRow = ['-1', '0', 'TOMATOES', '4999', '6', '', '', '', '', '5013', '6', '', '', '', '', '5006', '0'].join(';');
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
    const expectedRowCount = parsed.activitiesLog
      .split(/\r?\n/)
      .filter(line => line.trim().length > 0).length - 1;

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

