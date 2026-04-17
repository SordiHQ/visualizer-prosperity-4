import { Alert, Container, Grid, Group, Text, Title } from '@mantine/core';
import Highcharts from 'highcharts';
import { ReactNode, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store.ts';
import { getAskColor, getBidColor } from '../../utils/colors.ts';
import { formatNumber } from '../../utils/format.ts';
import { Chart } from '../visualizer/Chart.tsx';
import { VisualizerCard } from '../visualizer/VisualizerCard.tsx';
import { DashboardFiltersCard } from './DashboardFiltersCard.tsx';
import { DashboardFiltersState, DashboardTradePoint, ProductSeriesCache } from './dashboardTypes.ts';
import {
  collectProductSeries,
  downsamplePoints,
  findClosestTimestamp,
  formatTradeHoverFields,
  getDisplayedTrades,
  getTradeMarkerRadiusDelta,
  getTradesAtTimestamp,
  getVisibleMidPriceSeriesData,
  toScatterData,
} from './dashboardUtils.ts';
import { TimestampExplorerCard } from './TimestampExplorerCard.tsx';

const TIMESTAMP_STEP = 100;

const OWN_TRADE_TAKE_BASE_RADIUS = 4;
const OWN_TRADE_MAKE_BASE_RADIUS = 5;
const MARKET_TRADE_BASE_RADIUS = 6;

const OWN_TRADE_TAKE_MARKER_SYMBOL = 'circle';
const OWN_TRADE_MAKE_MARKER_SYMBOL = 'diamond';
const MARKET_TRADE_MARKER_SYMBOL = 'triangle';

const OWN_TRADE_TAKE_COLOR_SELL_FILL = 'blue';
const OWN_TRADE_MAKE_COLOR_SELL_FILL = 'cyan';

const OWN_TRADE_TAKE_COLOR_BUY_FILL = 'orange';
const OWN_TRADE_MAKE_COLOR_BUY_FILL = 'yellow'; //amber #ffbf00 FIXME: find something similar that allows to see also in LIGHT MODE (yellow is BAD)

const defaultFilters: DashboardFiltersState = {
  showOrderBookLevels: true,
  showOwnTrades: true,
  showMarketTrades: true,
  scaleTradeMarkersByVolume: false,
  midPrice: {
    show: true,
    dropZeroPoints: true,
    advanced: {
      enabled: false,
      bidAskSpread: 0,
    },
  },
  showPnlOverlay: false,
  minQuantity: 0,
  maxQuantity: 160,
  includeTraderIds: '',
  excludeTraderIds: '',
  maxPoints: 5000,
};

function formatTradeTooltipHtml(color: string, seriesName: string, custom: DashboardTradePoint): string {
  return `<span style="color:${color}">\u25CF</span> ${seriesName}: <br/> ${formatTradeHoverFields(custom)}<br/>`;
}

function tradePointFormatter(this: Highcharts.Point): string {
  const custom = (this.options as any).custom as DashboardTradePoint | undefined;
  if (!custom) {
    return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <br/> <b>no trade details</b><br/>`;
  }
  return formatTradeTooltipHtml(String(this.color), this.series.name, custom);
}

function getTradeMarkerRadius(quantity: number, baseRadius: number, scaleByVolume: boolean): number {
  if (!scaleByVolume) {
    return baseRadius;
  }

  return baseRadius + getTradeMarkerRadiusDelta(quantity);
}

function buildPriceChartSeries(
  productCache: ProductSeriesCache | null,
  filters: DashboardFiltersState,
  filteredOwnTakeTrades: DashboardTradePoint[],
  filteredOwnMakeTrades: DashboardTradePoint[],
  filteredMarketTrades: DashboardTradePoint[],
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

  if (filters.midPrice.show) {
    series.push({
      type: 'line',
      name: 'Mid price',
      color: 'gray',
      dashStyle: 'Dash',
      data: getVisibleMidPriceSeriesData(
        productCache.midPrice,
        productCache.bidSeries,
        productCache.askSeries,
        filters.midPrice,
      ),
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
    const ownTakeData = toScatterData(filteredOwnTakeTrades).map(point => ({
      ...point,
      color:
        point.custom?.classifiedTrade.trade.seller === 'SUBMISSION'
          ? OWN_TRADE_TAKE_COLOR_SELL_FILL
          : OWN_TRADE_TAKE_COLOR_BUY_FILL,
      marker: {
        radius: getTradeMarkerRadius(
          point.custom?.quantity ?? 0,
          OWN_TRADE_TAKE_BASE_RADIUS,
          filters.scaleTradeMarkersByVolume,
        ),
      },
    }));

    const ownMakeData = toScatterData(filteredOwnMakeTrades).map(point => ({
      ...point,
      color:
        point.custom?.classifiedTrade.trade.seller === 'SUBMISSION'
          ? OWN_TRADE_MAKE_COLOR_SELL_FILL
          : OWN_TRADE_MAKE_COLOR_BUY_FILL,
      marker: {
        radius: getTradeMarkerRadius(
          point.custom?.quantity ?? 0,
          OWN_TRADE_MAKE_BASE_RADIUS,
          filters.scaleTradeMarkersByVolume,
        ),
      },
    }));

    series.push({
      type: 'scatter',
      name: 'TAKE Own trades',
      color: 'gray',
      marker: { symbol: OWN_TRADE_TAKE_MARKER_SYMBOL, radius: OWN_TRADE_TAKE_BASE_RADIUS },
      data: ownTakeData,
      tooltip: {
        pointFormatter: tradePointFormatter,
      },
    });
    series.push({
      type: 'scatter',
      name: 'MAKE Own trades',
      color: 'gray',
      marker: { symbol: OWN_TRADE_MAKE_MARKER_SYMBOL, radius: OWN_TRADE_MAKE_BASE_RADIUS },
      data: ownMakeData,
      tooltip: {
        pointFormatter: tradePointFormatter,
      },
    });
  }

  if (filters.showMarketTrades) {
    const marketTradeData = toScatterData(filteredMarketTrades).map(point => ({
      ...point,
      marker: {
        radius: getTradeMarkerRadius(
          point.custom?.quantity ?? 0,
          MARKET_TRADE_BASE_RADIUS,
          filters.scaleTradeMarkersByVolume,
        ),
      },
    }));

    series.push({
      type: 'scatter',
      name: 'Market trades',
      color: 'magenta',
      marker: { symbol: MARKET_TRADE_MARKER_SYMBOL, radius: MARKET_TRADE_BASE_RADIUS },
      data: marketTradeData,
      tooltip: {
        pointFormatter: tradePointFormatter,
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

  return series;
}

function getPriceChartOptions(onSelectTimestamp: (timestamp: number) => void): Highcharts.Options {
  return {
    plotOptions: {
      series: {
        point: {
          events: {
            click(this: Highcharts.Point) {
              if (typeof this.x === 'number') {
                onSelectTimestamp(this.x);
              }
            },
          },
        },
        dataGrouping: {
          enabled: false,
        },
      },
    },
    yAxis: [
      { title: { text: 'Price' }, opposite: false, allowDecimals: true },
      { title: { text: 'P/L' }, opposite: true, allowDecimals: true },
    ],
    tooltip: {
      shared: true,
      outside: true,
      formatter: function () {
        const x = Number(this.x);
        const header = `<b>Timestamp ${formatNumber(x)}</b><br/>`;
        const points = this.points ?? [];

        // Highcharts may call formatter with a single point context (no this.points).
        // In that case, we still render the hovered datapoint details.
        if (points.length === 0 && this.point) {
          const singleCustom = (this.point.options as any).custom as DashboardTradePoint | undefined;
          if (singleCustom) {
            return `${header}${formatTradeTooltipHtml(String(this.color), this.series.name, singleCustom)}`;
          }
          if (typeof this.y === 'number') {
            return `${header}<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${formatNumber(this.y)}</b><br/>`;
          }
          return header;
        }

        const body = points
          .map(point => {
            if (point.series.type === 'scatter') {
              const custom = (point.point.options as any).custom as DashboardTradePoint | undefined;
              if (!custom) return '';
              return formatTradeTooltipHtml(String(point.color), point.series.name, custom);
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
    () => collectProductSeries(algorithm.activityLogs, algorithm.marketTrades),
    [algorithm.activityLogs, algorithm.marketTrades],
  );
  const products = useMemo(() => Object.keys(productsByCache).sort((a, b) => a.localeCompare(b)), [productsByCache]);
  const effectiveProduct =
    selectedProduct && productsByCache[selectedProduct] ? selectedProduct : (products[0] ?? null);
  const productCache = effectiveProduct ? productsByCache[effectiveProduct] : null;

  const productTimelineTimestamps = useMemo(() => (productCache ? [...productCache.timestamps] : []), [productCache]);

  const effectiveTimestamp = useMemo(() => {
    if (productTimelineTimestamps.length === 0) return null;
    if (selectedTimestamp === null) return productTimelineTimestamps[0];
    return findClosestTimestamp(productTimelineTimestamps, selectedTimestamp);
  }, [productTimelineTimestamps, selectedTimestamp]);

  const { filteredOwnTakeTrades, filteredOwnMakeTrades, filteredMarketTrades, displayedTrades } = useMemo(
    () => getDisplayedTrades(productCache, filters),
    [productCache, filters],
  );
  const priceChartSeries = useMemo(
    () =>
      buildPriceChartSeries(productCache, filters, filteredOwnTakeTrades, filteredOwnMakeTrades, filteredMarketTrades),
    [productCache, filters, filteredOwnTakeTrades, filteredOwnMakeTrades, filteredMarketTrades],
  );
  const priceChartOptions = useMemo(() => getPriceChartOptions(setSelectedTimestamp), [setSelectedTimestamp]);

  const pnlSeries = useMemo<Highcharts.SeriesOptionsType[]>(
    () =>
      productCache
        ? [{ type: 'line', name: 'Product P/L', data: downsamplePoints(productCache.pnl, filters.maxPoints) }]
        : [],
    [productCache, filters.maxPoints],
  );

  const hoveredTradeDetails = useMemo(
    () => (effectiveTimestamp ? getTradesAtTimestamp(displayedTrades, effectiveTimestamp) : []),
    [displayedTrades, effectiveTimestamp],
  );

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
                showPanControls
              />
            </Grid.Col>
            <Grid.Col span={{ xs: 12, md: 6 }}>
              <Chart title={`${productCache.product} - Product P/L`} series={pnlSeries} />
            </Grid.Col>
            <Grid.Col span={12}>
              <TimestampExplorerCard
                timestamps={productTimelineTimestamps}
                step={TIMESTAMP_STEP}
                effectiveTimestamp={effectiveTimestamp}
                hoveredTradeDetails={hoveredTradeDetails}
                onTimestampChange={setSelectedTimestamp}
              />
            </Grid.Col>
          </>
        )}
      </Grid>
    </Container>
  );
}
