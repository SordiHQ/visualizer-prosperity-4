import { Text } from '@mantine/core';
import { ReactNode } from 'react';
import { ActivityLogRow, Algorithm, AlgorithmDataRow, AlgorithmSummary } from '../models.ts';
import { parseAlgorithmLogs as parseLegacyAlgorithmLogs } from './algorithm.tsx';
import { extractJsonLogs, getActivityLogsFromParsedJson, getAlgorithmDataFromJson } from './logParsingUtils.ts';

export class AlgorithmParseError extends Error {
  public constructor(public readonly node: ReactNode) {
    super('Failed to parse algorithm logs');
  }
}

export function parseAlgorithmLogs(logs: string, summary?: AlgorithmSummary): Algorithm {
  const parsedJsonLogs = extractJsonLogs(logs);
  const hasJsonShape = parsedJsonLogs.activitiesLog.length > 0 && Array.isArray(parsedJsonLogs.logs);

  if (!hasJsonShape) {
    const legacyAlgorithm = parseLegacyAlgorithmLogs(logs, summary);
    return {
      ...legacyAlgorithm,
      source: 'legacy-format',
      warnings: [
        ...(legacyAlgorithm.warnings ?? []),
        'Legacy log format detected. Parsed with backward-compatible mode; some fields may differ from the current format.',
      ],
    };
  }

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

  const submissionId = typeof parsedJsonLogs.submissionId === 'string' ? parsedJsonLogs.submissionId.trim() : '';
  const source = submissionId.length > 0 ? 'prosperity-submission' : 'backtester';

  return {
    summary,
    activityLogs,
    data,
    source,
    submissionId: submissionId.length > 0 ? submissionId : undefined,
  };
}
