import { ActivityLogRow, AlgorithmDataRow, ParsedJsonLogs } from '../models.ts';

export function extractJsonLogs(logs: string): ParsedJsonLogs {
  try {
    const parsed = JSON.parse(logs);
    if (typeof parsed?.activitiesLog === 'string') {
      return parsed as ParsedJsonLogs;
    }
  } catch {
    // Not JSON payload, ignore.
  }
  return {
    activitiesLog: '',
  };
}

export function getActivityLogsFromParsedJson(logs: ParsedJsonLogs): ActivityLogRow[] {
  if (logs === null || typeof logs.activitiesLog !== 'string' || logs.activitiesLog.trim().length === 0) {
    return [];
  }

  return logs.activitiesLog
    .split(/\r?\n/)
    .filter((line, index) => index > 0 && line.trim().length > 0)
    .map(line => {
      const columns = line.split(';');
      return {
        day: Number(columns[0]),
        timestamp: Number(columns[1]),
        product: columns[2],
        bidPrices: getColumnValues(columns, [3, 5, 7]),
        bidVolumes: getColumnValues(columns, [4, 6, 8]),
        askPrices: getColumnValues(columns, [9, 11, 13]),
        askVolumes: getColumnValues(columns, [10, 12, 14]),
        midPrice: Number(columns[15]),
        profitLoss: Number(columns[16]),
      };
    })
    .filter(
      row =>
        Number.isFinite(row.day) &&
        Number.isFinite(row.timestamp) &&
        typeof row.product === 'string' &&
        row.product.length > 0,
    );
}

function getColumnValues(columns: string[], indices: number[]): number[] {
  const values: number[] = [];

  for (const index of indices) {
    const value = columns[index];
    if (value !== '') {
      values.push(parseFloat(value));
    }
  }

  return values;
}

export function getAlgorithmDataFromJson(allLogs: ParsedJsonLogs): AlgorithmDataRow[] {
  // TODO
  const algoLogs = allLogs.logs;
  console.log(algoLogs);
  const rows: AlgorithmDataRow[] = [];
  return rows;
}
