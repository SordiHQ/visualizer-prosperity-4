import { ActionIcon, Box, Group } from '@mantine/core';
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp } from '@tabler/icons-react';
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
}

const PAN_RATIO = 0.2;

function getAxisExtremes(axis: Highcharts.Axis): { min: number; max: number } | null {
  const { min, max, dataMin, dataMax } = axis.getExtremes();
  const effectiveMin = typeof min === 'number' ? min : dataMin;
  const effectiveMax = typeof max === 'number' ? max : dataMax;
  if (typeof effectiveMin !== 'number' || typeof effectiveMax !== 'number') {
    return null;
  }
  return { min: effectiveMin, max: effectiveMax };
}

export function Chart({ title, options, series, min, max, showPanControls = false }: ChartProps): ReactNode {
  const colorScheme = useActualColorScheme();
  const selectedTimestamp = useStore(state => state.selectedTimestamp);
  const setSelectedTimestamp = useStore(state => state.setSelectedTimestamp);
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const panAxis = useCallback((axis: Highcharts.Axis | undefined, direction: -1 | 1): boolean => {
    if (!axis) {
      return false;
    }

    const extremes = getAxisExtremes(axis);
    if (!extremes) {
      return false;
    }

    const range = extremes.max - extremes.min;
    if (range <= 0) {
      return false;
    }

    const shift = range * PAN_RATIO * direction;
    let nextMin = extremes.min + shift;
    let nextMax = extremes.max + shift;

    const { dataMin, dataMax } = axis.getExtremes();
    if (typeof dataMin === 'number' && typeof dataMax === 'number') {
      const dataRange = dataMax - dataMin;
      if (range >= dataRange) {
        nextMin = dataMin;
        nextMax = dataMax;
      } else {
        if (nextMin < dataMin) {
          nextMin = dataMin;
          nextMax = dataMin + range;
        }

        if (nextMax > dataMax) {
          nextMax = dataMax;
          nextMin = dataMax - range;
        }
      }
    }

    axis.setExtremes(nextMin, nextMax, false, false);
    return true;
  }, []);

  const panChart = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      const chart = chartRef.current?.chart;
      if (!chart) {
        return;
      }

      let didPan = false;
      if (direction === 'left') {
        didPan = panAxis(chart.xAxis[0], -1);
      }
      if (direction === 'right') {
        didPan = panAxis(chart.xAxis[0], 1);
      }
      if (direction === 'up') {
        didPan = panAxis(chart.yAxis[0], 1);
      }
      if (direction === 'down') {
        didPan = panAxis(chart.yAxis[0], -1);
      }

      if (didPan) {
        chart.redraw(false);
      }
    },
    [panAxis],
  );

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
        {showPanControls && (
          <Box pos="absolute" top={8} right={8} style={{ zIndex: 2 }}>
            <Group justify="center" gap={4} mb={4}>
              <ActionIcon variant="filled" aria-label="Pan chart up" onClick={() => panChart('up')}>
                <IconArrowUp size={16} />
              </ActionIcon>
            </Group>
            <Group justify="center" gap={4} wrap="nowrap" mb={4}>
              <ActionIcon variant="filled" aria-label="Pan chart left" onClick={() => panChart('left')}>
                <IconArrowLeft size={16} />
              </ActionIcon>
              <ActionIcon variant="filled" aria-label="Pan chart right" onClick={() => panChart('right')}>
                <IconArrowRight size={16} />
              </ActionIcon>
            </Group>
            <Group justify="center" gap={4}>
              <ActionIcon variant="filled" aria-label="Pan chart down" onClick={() => panChart('down')}>
                <IconArrowDown size={16} />
              </ActionIcon>
            </Group>
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
