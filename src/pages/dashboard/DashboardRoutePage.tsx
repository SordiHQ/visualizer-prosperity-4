import { Alert, Container, Grid, Group, Text, Title } from '@mantine/core';
import Highcharts from 'highcharts';
import { ReactNode, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlgorithmDataRow } from '../../models.ts';
import { useStore } from '../../store.ts';
import { getAskColor, getBidColor } from '../../utils/colors.ts';
import { formatNumber } from '../../utils/format.ts';
import { Chart } from '../visualizer/Chart.tsx';
import { VisualizerCard } from '../visualizer/VisualizerCard.tsx';
import { DashboardFiltersCard } from './DashboardFiltersCard.tsx';
import { DashboardFiltersState, ProductSeriesCache, TradePointMeta } from './dashboardTypes.ts';
import {
  collectProductSeries,
  downsamplePoints,
  findClosestTimestamp,
  formatProductLogs,
  formatTradeLine,
  getDisplayedTrades,
  getTradesAtTimestamp,
  toScatterData,
} from './dashboardUtils.ts';
import { LogViewerCard } from './LogViewerCard.tsx';
import { TimestampExplorerCard } from './TimestampExplorerCard.tsx';

const defaultFilters: DashboardFiltersState = {
  showOrderBookLevels: true,
  showOwnTrades: true,
  showMarketTrades: true,
  showMidPrice: true,
  showPnlOverlay: false,
  showPositionOverlay: false,
  minQuantity: 0,
  maxQuantity: 50,
  includeTraderIds: '',
  excludeTraderIds: '',
  maxPoints: 5000,
};

function buildPriceChartSeries(
  productCache: ProductSeriesCache | null,
  filters: DashboardFiltersState,
  filteredOwnTrades: Array<[number, number, TradePointMeta]>,
  filteredMarketTrades: Array<[number, number, TradePointMeta]>,
): Highcharts.SeriesOptionsType[] {
  if (!productCache) return [];
  const series: Highcharts.SeriesOptionsType[] = [];

  if (filters.showOrderBookLevels) {
    for (let i = 0; i < 3; i++) {
      series.push({
        type: 'line',
        name: `Bid ${3 - i}`,
        color: getBidColor(0.5 + i * 0.25),
        data: productCache.bidSeries[i],
        marker: { enabled: false },
      });
    }
  }

  if (filters.showMidPrice) {
    series.push({
      type: 'line',
      name: 'Mid price',
      color: 'gray',
      dashStyle: 'Dash',
      data: productCache.midPrice,
      marker: { enabled: false },
    });
  }

  if (filters.showOrderBookLevels) {
    for (let i = 0; i < 3; i++) {
      series.push({
        type: 'line',
        name: `Ask ${i + 1}`,
        color: getAskColor(1 - i * 0.25),
        data: productCache.askSeries[i],
        marker: { enabled: false },
      });
    }
  }

  if (filters.showOwnTrades) {
    series.push({
      type: 'scatter',
      name: 'Own trades',
      color: '#f08c00',
      marker: { symbol: 'cross', radius: 4 },
      data: toScatterData(filteredOwnTrades),
      tooltip: {
        pointFormatter: function () {
          const custom = (this.options as any).custom as TradePointMeta;
          return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: ${formatTradeLine(custom)}<br/>`;
        },
      },
    });
  }

  if (filters.showMarketTrades) {
    series.push({
      type: 'scatter',
      name: 'Market trades',
      color: '#7c2d12',
      marker: { symbol: 'circle', radius: 3 },
      data: toScatterData(filteredMarketTrades),
      tooltip: {
        pointFormatter: function () {
          const custom = (this.options as any).custom as TradePointMeta;
          return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: ${formatTradeLine(custom)}<br/>`;
        },
      },
    });
  }

  if (filters.showPnlOverlay) {
    series.push({
      type: 'line',
      name: 'P/L',
      yAxis: 1,
      color: '#2f9e44',
      dashStyle: 'ShortDot',
      data: productCache.pnl,
      marker: { enabled: false },
    });
  }

  if (filters.showPositionOverlay) {
    series.push({
      type: 'line',
      name: 'Position',
      yAxis: 1,
      color: '#1c7ed6',
      dashStyle: 'ShortDot',
      data: productCache.position,
      marker: { enabled: false },
    });
  }

  return series;
}

function getPriceChartOptions(): Highcharts.Options {
  return {
    yAxis: [
      { title: { text: 'Price' }, opposite: false, allowDecimals: true },
      { title: { text: 'P/L & Position' }, opposite: true, allowDecimals: true },
    ],
    tooltip: {
      formatter: function () {
        const x = Number(this.x);
        const header = `<b>Timestamp ${formatNumber(x)}</b><br/>`;
        const body = (this.points ?? [])
          .map(point => {
            if (point.series.type === 'scatter') {
              const custom = (point.point.options as any).custom as TradePointMeta | undefined;
              if (!custom) return '';
              return `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: ${formatTradeLine(custom)}<br/>`;
            }
            return `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: <b>${formatNumber(point.y as number)}</b><br/>`;
          })
          .join('');
        return header + body;
      },
    },
  };
}

export function DashboardRoutePage(): ReactNode {
  const algorithm = useStore(state => state.algorithm);
  const selectedTimestamp = useStore(state => state.selectedTimestamp);
  const setSelectedTimestamp = useStore(state => state.setSelectedTimestamp);
  const { search } = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFiltersState>(defaultFilters);

  if (algorithm === null) return <Navigate to={`/${search}`} />;

  const productsByCache = useMemo(
    () => collectProductSeries(algorithm.data, algorithm.activityLogs),
    [algorithm.activityLogs, algorithm.data],
  );
  const products = useMemo(() => Object.keys(productsByCache).sort((a, b) => a.localeCompare(b)), [productsByCache]);
  const effectiveProduct =
    selectedProduct && productsByCache[selectedProduct] ? selectedProduct : (products[0] ?? null);
  const productCache = effectiveProduct ? productsByCache[effectiveProduct] : null;

  const rowsByTimestamp = useMemo(() => {
    const rows: Record<number, AlgorithmDataRow> = {};
    for (const row of algorithm.data) rows[row.state.timestamp] = row;
    return rows;
  }, [algorithm.data]);

  const effectiveTimestamp = useMemo(() => {
    if (!productCache || productCache.timestamps.length === 0) return null;
    if (selectedTimestamp === null) return productCache.timestamps[0];
    return findClosestTimestamp(productCache.timestamps, selectedTimestamp);
  }, [productCache, selectedTimestamp]);

  const { filteredOwnTrades, filteredMarketTrades, displayedTrades } = useMemo(
    () => getDisplayedTrades(productCache, filters),
    [productCache, filters],
  );
  const priceChartSeries = useMemo(
    () => buildPriceChartSeries(productCache, filters, filteredOwnTrades, filteredMarketTrades),
    [productCache, filters, filteredOwnTrades, filteredMarketTrades],
  );
  const priceChartOptions = useMemo(() => getPriceChartOptions(), []);

  const pnlSeries = useMemo<Highcharts.SeriesOptionsType[]>(
    () =>
      productCache
        ? [{ type: 'line', name: 'Product P/L', data: downsamplePoints(productCache.pnl, filters.maxPoints) }]
        : [],
    [productCache, filters.maxPoints],
  );
  const positionSeries = useMemo<Highcharts.SeriesOptionsType[]>(
    () =>
      productCache
        ? [{ type: 'line', name: 'Position', data: downsamplePoints(productCache.position, filters.maxPoints) }]
        : [],
    [productCache, filters.maxPoints],
  );

  const hoveredTradeDetails = useMemo(
    () => (effectiveTimestamp ? getTradesAtTimestamp(displayedTrades, effectiveTimestamp) : []),
    [displayedTrades, effectiveTimestamp],
  );

  const selectedRow = effectiveTimestamp === null ? null : rowsByTimestamp[effectiveTimestamp];
  const syncedLogs =
    selectedRow && effectiveProduct ? formatProductLogs(selectedRow, effectiveProduct) : 'No timestamp selected.';

  return (
    <Container fluid>
      <Grid>
        <Grid.Col span={12}>
          <VisualizerCard>
            <Group justify="space-between">
              <Title order={2}>Dashboard</Title>
              <Text c="dimmed">Fast single-product explorer</Text>
            </Group>
          </VisualizerCard>
        </Grid.Col>

        {!productCache ? (
          <Grid.Col span={12}>
            <Alert color="yellow" title="No products available">
              No product data found in the loaded algorithm.
            </Alert>
          </Grid.Col>
        ) : (
          <>
            <Grid.Col span={{ xs: 12, md: 4 }}>
              <DashboardFiltersCard
                products={products}
                selectedProduct={effectiveProduct}
                setSelectedProduct={setSelectedProduct}
                filters={filters}
                setFilters={setFilters}
              />
            </Grid.Col>
            <Grid.Col span={{ xs: 12, md: 8 }}>
              <Chart
                title={`${productCache.product} - Price, order book and trades`}
                series={priceChartSeries}
                options={priceChartOptions}
              />
            </Grid.Col>
            <Grid.Col span={{ xs: 12, md: 6 }}>
              <Chart title={`${productCache.product} - Product P/L`} series={pnlSeries} />
            </Grid.Col>
            <Grid.Col span={{ xs: 12, md: 6 }}>
              <Chart title={`${productCache.product} - Position`} series={positionSeries} />
            </Grid.Col>
            <Grid.Col span={12}>
              <TimestampExplorerCard
                timestamps={productCache.timestamps}
                effectiveTimestamp={effectiveTimestamp}
                hoveredTradeDetails={hoveredTradeDetails}
                onTimestampChange={setSelectedTimestamp}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <LogViewerCard logs={syncedLogs} />
            </Grid.Col>
          </>
        )}
      </Grid>
    </Container>
  );
}
