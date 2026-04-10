import { Slider, Stack, Text } from '@mantine/core';
import { ReactNode } from 'react';
import { formatNumber } from '../../utils/format.ts';
import { VisualizerCard } from '../visualizer/VisualizerCard.tsx';
import { TradePointMeta } from './dashboardTypes.ts';
import { formatTradeLine } from './dashboardUtils.ts';

interface TimestampExplorerCardProps {
  timestamps: number[];
  effectiveTimestamp: number | null;
  hoveredTradeDetails: TradePointMeta[];
  onTimestampChange: (value: number) => void;
}

export function TimestampExplorerCard({
  timestamps,
  effectiveTimestamp,
  hoveredTradeDetails,
  onTimestampChange,
}: TimestampExplorerCardProps): ReactNode {
  const min = timestamps[0];
  const max = timestamps[timestamps.length - 1];
  const step = timestamps.length >= 2 ? Math.max(1, timestamps[1] - timestamps[0]) : 1;

  return (
    <VisualizerCard title="Timestamp Explorer">
      <Slider
        min={min}
        max={max}
        step={step}
        value={effectiveTimestamp ?? min}
        onChange={onTimestampChange}
        label={value => `Timestamp ${formatNumber(value)}`}
        mb="md"
      />
      <Text size="sm" fw={600}>
        Hovered/selected timestamp: {effectiveTimestamp === null ? 'N/A' : formatNumber(effectiveTimestamp)}
      </Text>
      {hoveredTradeDetails.length === 0 ? (
        <Text size="sm" c="dimmed">
          No visible trades match the current filters at this timestamp.
        </Text>
      ) : (
        <Stack gap={2} mt="xs">
          {hoveredTradeDetails.slice(0, 12).map((trade, index) => (
            <Text key={index} size="sm">
              {formatTradeLine(trade)}
            </Text>
          ))}
        </Stack>
      )}
    </VisualizerCard>
  );
}
