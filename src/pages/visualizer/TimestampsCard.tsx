import { Slider, SliderProps, Text } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { ReactNode, useEffect, useMemo } from 'react';
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
      () => setSelectedTimestamp(effectiveTimestamp === timestampMin ? effectiveTimestamp : effectiveTimestamp - timestampStep),
    ],
    [
      'ArrowRight',
      () => setSelectedTimestamp(effectiveTimestamp === timestampMax ? effectiveTimestamp : effectiveTimestamp + timestampStep),
    ],
  ]);

  return (
    <VisualizerCard title="Timestamps">
      <Slider
        min={timestampMin}
        max={timestampMax}
        step={timestampStep}
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
