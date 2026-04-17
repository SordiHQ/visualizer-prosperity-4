import { ActionIcon, Box, Group } from '@mantine/core';
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconRefresh,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import Highcharts from 'highcharts/highstock';
import HighchartsAccessibility from 'highcharts/modules/accessibility';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsOfflineExporting from 'highcharts/modules/offline-exporting';
import HighchartsHighContrastDarkTheme from 'highcharts/themes/high-contrast-dark';
import HighchartsReact from 'highcharts-react-official';
import merge from 'lodash/merge';
import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { useActualColorScheme } from '../../hooks/use-actual-color-scheme.ts';
import { useStore } from '../../store.ts';
import { formatNumber } from '../../utils/format.ts';
import { panChart, type PanDirection } from './chartPanUtils.ts';
import { resetChartZoom, zoomChart, type ZoomDirection } from './chartZoomUtils.ts';
import { VisualizerCard } from './VisualizerCard.tsx';

HighchartsAccessibility(Highcharts);
HighchartsExporting(Highcharts);
HighchartsOfflineExporting(Highcharts);

// Highcharts themes are distributed as Highcharts extensions
// The normal way to use them is to apply these extensions to the global Highcharts object
// However, themes work by overriding the default options, with no way to rollback
// To make theme switching work, we merge theme options into the local chart options instead
// This way we don't override the global defaults and can change themes without refreshing
// This function is a little workaround to be able to get the options a theme overrides
function getThemeOptions(theme: (highcharts: typeof Highcharts) => void): Highcharts.Options {
  const highchartsMock = {
    _modules: {
      'Core/Globals.js': {
        theme: null,
      },
      'Core/Defaults.js': {
        setOptions: () => {
          // Do nothing
        },
      },
    },
    win: {
      dispatchEvent: () => {},
    },
  };

  theme(highchartsMock as any);

  return highchartsMock._modules['Core/Globals.js'].theme! as Highcharts.Options;
}

interface ChartProps {
  title: string;
  options?: Highcharts.Options;
  series: Highcharts.SeriesOptionsType[];
  min?: number;
  max?: number;
  showPanControls?: boolean;
  showZoomControls?: boolean;
}

export function Chart({
  title,
  options,
  series,
  min,
  max,
  showPanControls = false,
  showZoomControls = false,
}: ChartProps): ReactNode {
  const colorScheme = useActualColorScheme();
  const selectedTimestamp = useStore(state => state.selectedTimestamp);
  const setSelectedTimestamp = useStore(state => state.setSelectedTimestamp);
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const handlePan = useCallback((direction: PanDirection) => {
    panChart(chartRef.current?.chart, direction);
  }, []);

  const handleZoom = useCallback((direction: ZoomDirection) => {
    zoomChart(chartRef.current?.chart, direction);
  }, []);

  const handleResetZoom = useCallback(() => {
    resetChartZoom(chartRef.current?.chart);
  }, []);

  const fullOptions = useMemo((): Highcharts.Options => {
    const themeOptions = colorScheme === 'light' ? {} : getThemeOptions(HighchartsHighContrastDarkTheme);

    const chartOptions: Highcharts.Options = {
      chart: {
        animation: false,
        height: 400,
        zooming: {
          type: 'x',
        },
        panning: {
          enabled: true,
          type: 'x',
        },
        panKey: 'shift',
        numberFormatter: formatNumber,
        events: {
          load() {
            Highcharts.addEvent(this.tooltip, 'headerFormatter', (e: any) => {
              if (e.isFooter) {
                return true;
              }

              let timestamp = e.labelConfig.point.x;

              if (e.labelConfig.point.dataGroup) {
                const xData = e.labelConfig.series.xData;
                const lastTimestamp = xData[xData.length - 1];
                if (timestamp + 100 * e.labelConfig.point.dataGroup.length >= lastTimestamp) {
                  timestamp = lastTimestamp;
                }
              }

              e.text = `Timestamp ${formatNumber(timestamp)}<br/>`;
              return false;
            });
          },
        },
      },
      title: {
        text: title,
      },
      credits: {
        href: 'javascript:window.open("https://www.highcharts.com/?credits", "_blank")',
      },
      plotOptions: {
        series: {
          point: {
            events: {
              click(this: Highcharts.Point) {
                if (typeof this.x === 'number') {
                  setSelectedTimestamp(this.x);
                }
              },
            },
          },
          dataGrouping: {
            approximation(this: any, values: number[]): number {
              const endIndex = this.dataGroupInfo.start + this.dataGroupInfo.length;
              if (endIndex < this.xData.length) {
                return values[0];
              } else {
                return values[values.length - 1];
              }
            },
            anchor: 'start',
            firstAnchor: 'firstPoint',
            lastAnchor: 'lastPoint',
            units: [['second', [1, 2, 5, 10]]],
          },
        },
      },
      xAxis: {
        type: 'datetime',
        title: {
          text: 'Timestamp',
        },
        crosshair: {
          width: 1,
        },
        labels: {
          formatter: params => formatNumber(params.value as number),
        },
      },
      yAxis: {
        opposite: false,
        allowDecimals: false,
        min,
        max,
      },
      tooltip: {
        split: false,
        shared: true,
        outside: true,
      },
      legend: {
        enabled: true,
      },
      rangeSelector: {
        enabled: false,
      },
      navigator: {
        enabled: false,
      },
      scrollbar: {
        enabled: false,
      },
      series,
      ...options,
    };

    return merge(themeOptions, chartOptions);
  }, [colorScheme, title, options, series, min, max, setSelectedTimestamp]);

  useEffect(() => {
    const chart = chartRef.current?.chart;
    const xAxis = chart?.xAxis?.[0];
    if (!chart || !xAxis) {
      return;
    }

    xAxis.removePlotLine('selected-timestamp');
    if (selectedTimestamp !== null) {
      xAxis.addPlotLine({
        id: 'selected-timestamp',
        value: selectedTimestamp,
        color: '#d9480f',
        width: 1,
        zIndex: 5,
        dashStyle: 'Dash',
      });
    }
    chart.redraw(false);
  }, [selectedTimestamp]);

  return (
    <VisualizerCard p={0}>
      <Box pos="relative">
        {(showPanControls || showZoomControls) && (
          <Box pos="absolute" top={8} right={8} style={{ zIndex: 2 }}>
            {showPanControls && (
              <>
                <Group justify="center" gap={4} mb={4}>
                  <ActionIcon variant="filled" aria-label="Pan chart up" onClick={() => handlePan('up')}>
                    <IconArrowUp size={16} />
                  </ActionIcon>
                </Group>
                <Group justify="center" gap={4} wrap="nowrap" mb={4}>
                  <ActionIcon variant="filled" aria-label="Pan chart left" onClick={() => handlePan('left')}>
                    <IconArrowLeft size={16} />
                  </ActionIcon>
                  <ActionIcon variant="filled" aria-label="Pan chart right" onClick={() => handlePan('right')}>
                    <IconArrowRight size={16} />
                  </ActionIcon>
                </Group>
                <Group justify="center" gap={4} mb={showZoomControls ? 6 : 0}>
                  <ActionIcon variant="filled" aria-label="Pan chart down" onClick={() => handlePan('down')}>
                    <IconArrowDown size={16} />
                  </ActionIcon>
                </Group>
              </>
            )}
            {showZoomControls && (
              <Group justify="center" gap={4} wrap="nowrap">
                <ActionIcon variant="filled" aria-label="Zoom chart in" onClick={() => handleZoom('in')}>
                  <IconZoomIn size={16} />
                </ActionIcon>
                <ActionIcon variant="filled" aria-label="Reset chart zoom" onClick={handleResetZoom}>
                  <IconRefresh size={16} />
                </ActionIcon>
                <ActionIcon variant="filled" aria-label="Zoom chart out" onClick={() => handleZoom('out')}>
                  <IconZoomOut size={16} />
                </ActionIcon>
              </Group>
            )}
          </Box>
        )}
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          constructorType={'stockChart'}
          options={fullOptions}
          immutable={false}
        />
      </Box>
    </VisualizerCard>
  );
}
