import { ActionIcon, Group, NumberInput, SegmentedControl, Slider, SliderProps, Text, Tooltip } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { AlgorithmDataRow } from '../../models.ts';
import { useStore } from '../../store.ts';
import { formatNumber } from '../../utils/format.ts';
import { TimestampDetail } from './TimestampDetail.tsx';
import { VisualizerCard } from './VisualizerCard.tsx';

function findClosestTimestamp(timestamps: number[], target: number): number {
  if (timestamps.length === 0) {
    return target;
  }

  let left = 0;
  let right = timestamps.length - 1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const value = timestamps[middle];

    if (value === target) {
      return value;
    }

    if (value < target) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  if (left >= timestamps.length) {
    return timestamps[timestamps.length - 1];
  }

  if (right < 0) {
    return timestamps[0];
  }

  return target - timestamps[right] <= timestamps[left] - target ? timestamps[right] : timestamps[left];
}

export function TimestampsCard(): ReactNode {
  const [multiplierMode, setMultiplierMode] = useState<string>('1');
  const [customMultiplier, setCustomMultiplier] = useState<number | ''>('');
  const algorithm = useStore(state => state.algorithm)!;
  const selectedTimestamp = useStore(state => state.selectedTimestamp);
  const setSelectedTimestamp = useStore(state => state.setSelectedTimestamp);

  const rowsByTimestamp = useMemo((): Record<number, AlgorithmDataRow> => {
    const rowsByTimestamp: Record<number, AlgorithmDataRow> = {};
    for (const row of algorithm.data) {
      rowsByTimestamp[row.state.timestamp] = row;
    }
    return rowsByTimestamp;
  }, [algorithm.data]);

  const timestampMin = algorithm.data[0].state.timestamp;
  const timestampMax = algorithm.data[algorithm.data.length - 1].state.timestamp;
  const timestampStep = algorithm.data[1].state.timestamp - algorithm.data[0].state.timestamp;
  const effectiveMultiplier = useMemo(() => {
    if (multiplierMode !== 'custom') {
      return Number(multiplierMode);
    }

    if (typeof customMultiplier !== 'number') {
      return 1;
    }

    return Math.max(1, Math.round(customMultiplier));
  }, [multiplierMode, customMultiplier]);
  const effectiveTimestampStep = timestampStep * effectiveMultiplier;
  const timestamps = useMemo(() => algorithm.data.map(row => row.state.timestamp), [algorithm.data]);

  const effectiveTimestamp = useMemo(() => {
    if (selectedTimestamp === null) {
      return timestampMin;
    }

    if (rowsByTimestamp[selectedTimestamp] !== undefined) {
      return selectedTimestamp;
    }

    return findClosestTimestamp(timestamps, selectedTimestamp);
  }, [selectedTimestamp, timestampMin, rowsByTimestamp, timestamps]);

  useEffect(() => {
    if (selectedTimestamp === null) {
      setSelectedTimestamp(timestampMin);
    } else if (selectedTimestamp !== effectiveTimestamp) {
      setSelectedTimestamp(effectiveTimestamp);
    }
  }, [selectedTimestamp, effectiveTimestamp, timestampMin, setSelectedTimestamp]);

  const marks: SliderProps['marks'] = [];
  for (let i = timestampMin; i < timestampMax; i += (timestampMax + 100) / 4) {
    marks.push({
      value: i,
      label: formatNumber(i),
    });
  }

  useHotkeys([
    [
      'ArrowLeft',
      () =>
        setSelectedTimestamp(
          effectiveTimestamp === timestampMin
            ? effectiveTimestamp
            : Math.max(timestampMin, effectiveTimestamp - effectiveTimestampStep),
        ),
    ],
    [
      'ArrowRight',
      () =>
        setSelectedTimestamp(
          effectiveTimestamp === timestampMax
            ? effectiveTimestamp
            : Math.min(timestampMax, effectiveTimestamp + effectiveTimestampStep),
        ),
    ],
  ]);

  return (
    <VisualizerCard title="Timestamps">
      <Group justify="space-between" align="center" mb="xs">
        <Group gap="xs" align="center">
          <Text size="xs" c="dimmed">
            Step multiplier
          </Text>
          <SegmentedControl
            size="xs"
            value={multiplierMode}
            onChange={setMultiplierMode}
            data={[
              { value: '1', label: '1x' },
              { value: '2', label: '2x' },
              { value: '5', label: '5x' },
              { value: '10', label: '10x' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {multiplierMode === 'custom' && (
            <NumberInput
              size="xs"
              w={88}
              min={1}
              step={1}
              allowDecimal={false}
              value={customMultiplier}
              onChange={value => setCustomMultiplier(typeof value === 'number' ? value : '')}
              placeholder="e.g. 3"
            />
          )}
          <Tooltip
            label="Use ← → on your keyboard to move the current 
          selected timestamp by the selected multiplier (10x moves the timestamp by 10 timesteps)"
          >
            <ActionIcon variant="subtle" color="gray" size="sm" radius="xl" aria-label="Show timestamp hotkeys help">
              ?
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Slider
        min={timestampMin}
        max={timestampMax}
        step={effectiveTimestampStep}
        marks={marks}
        label={value => `Timestamp ${formatNumber(value)}`}
        value={effectiveTimestamp}
        onChange={setSelectedTimestamp}
        mb="lg"
      />

      {rowsByTimestamp[effectiveTimestamp] ? (
        <TimestampDetail row={rowsByTimestamp[effectiveTimestamp]} />
      ) : (
        <Text>No logs found for timestamp {formatNumber(effectiveTimestamp)}</Text>
      )}
    </VisualizerCard>
  );
}
