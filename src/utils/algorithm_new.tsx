import { Text } from '@mantine/core';
import { ReactNode } from 'react';
import { ActivityLogRow, Algorithm, AlgorithmDataRow, AlgorithmSummary } from '../models.ts';
import { extractJsonLogs, getActivityLogsFromParsedJson, getAlgorithmDataFromJson } from './logParsingUtils.ts';

export class AlgorithmParseError extends Error {
  public constructor(public readonly node: ReactNode) {
    super('Failed to parse algorithm logs');
  }
}

export function parseAlgorithmLogs(logs: string, summary?: AlgorithmSummary): Algorithm {
  const parsedJsonLogs = extractJsonLogs(logs);

  const activityLogs: ActivityLogRow[] = getActivityLogsFromParsedJson(parsedJsonLogs);
  const data: AlgorithmDataRow[] = getAlgorithmDataFromJson(parsedJsonLogs);

  // TODO: Add trades
  // const trades : Trade[] = getTradesFromParsedJson(parsedJsonLogs);

  if (activityLogs.length === 0 && data.length === 0) {
    throw new AlgorithmParseError(
      (
        <Text>
          Logs are empty, either something went wrong with your submission or your backtester logs in a different format
          than Prosperity&apos;s submission environment.
        </Text>
      ),
    );
  }

  if (activityLogs.length === 0 || data.length === 0) {
    throw new AlgorithmParseError(
      /* prettier-ignore */
      <Text>Logs are in invalid format.</Text>,
    );
  }

  if (activityLogs.length === 0 || data.length === 0) {
    throw new AlgorithmParseError(
      /* prettier-ignore */
      <Text>Logs are in invalid format.</Text>,
    );
  }

  return {
    summary,
    activityLogs,
    data,
  };
}
