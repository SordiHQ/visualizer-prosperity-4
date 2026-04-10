import { Text } from '@mantine/core';
import { ReactNode } from 'react';
import { VisualizerCard } from '../visualizer/VisualizerCard.tsx';

interface LogViewerCardProps {
  logs: string;
}

export function LogViewerCard({ logs }: LogViewerCardProps): ReactNode {
  return (
    <VisualizerCard title="Log Viewer (timestamp-synced)">
      <Text component="pre" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
        {logs}
      </Text>
    </VisualizerCard>
  );
}
