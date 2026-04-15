import Highcharts from 'highcharts';
import { ActivityLogRow, ClassifiedTrade } from '../../models.ts';
import { formatNumber } from '../../utils/format.ts';
import { DashboardFiltersState, DashboardTradePoint, ProductSeriesCache } from './dashboardTypes.ts';

export function findClosestTimestamp(timestamps: number[], target: number): number {
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

// TODO: eliminare
export function downsamplePoints<T>(points: T[], maxPoints: number): T[] {
  if (maxPoints <= 0 || points.length <= maxPoints) {
    return points;
  }

  const stride = Math.ceil(points.length / maxPoints);
  const sampled: T[] = [];
  for (let i = 0; i < points.length; i += stride) {
    sampled.push(points[i]);
  }

  const lastPoint = points[points.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint);
  }

  return sampled;
}

export function parseTraderIdList(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map(token => token.trim())
      .filter(Boolean),
  );
}

function includeTrade(
  point: DashboardTradePoint,
  includeIds: Set<string>,
  excludeIds: Set<string>,
  minQty: number,
  maxQty: number,
): boolean {
  if (point.quantity < minQty || point.quantity > maxQty) {
    return false;
  }

  const { buyer, seller } = point.classifiedTrade.trade;
  if (excludeIds.has(buyer) || excludeIds.has(seller)) {
    return false;
  }

  if (includeIds.size === 0) {
    return true;
  }

  return includeIds.has(buyer) || includeIds.has(seller);
}

function ensureCache(productCaches: Record<string, ProductSeriesCache>, product: string): ProductSeriesCache {
  if (!productCaches[product]) {
    productCaches[product] = {
      product,
      timestamps: [],
      midPrice: [],
      bidSeries: [[], [], []],
      askSeries: [[], [], []],
      pnl: [],
      ownTakeTrades: [],
      ownMakeTrades: [],
      marketTrades: [],
    };
  }
  return productCaches[product];
}

function addClassifiedTradeToCache(cache: ProductSeriesCache, classifiedTrade: ClassifiedTrade): void {
  const { trade } = classifiedTrade;
  const quantity = Math.abs(trade.quantity);

  if (classifiedTrade.side === 'market') {
    cache.marketTrades.push({
      classifiedTrade,
      executionType: 'market',
      quantity,
    });
    return;
  }

  // this sare not empty since they are empty only if it is a market trade (not own trade)
  const takeQty = Math.max(0, Math.abs(classifiedTrade.takeQty ?? 0));
  const makeQty = Math.max(0, Math.abs(classifiedTrade.makeQty ?? 0));

  if (takeQty > 0) {
    cache.ownTakeTrades.push({
      classifiedTrade,
      executionType: 'own_take',
      quantity: takeQty,
    });
  }

  if (makeQty > 0) {
    cache.ownMakeTrades.push({
      classifiedTrade,
      executionType: 'own_make',
      quantity: makeQty,
    });
  }
}

export function collectProductSeries(
  activityLogs: ActivityLogRow[],
  classifiedTrades: ClassifiedTrade[],
): Record<string, ProductSeriesCache> {
  const productCaches: Record<string, ProductSeriesCache> = {};

  for (const row of activityLogs) {
    const cache = ensureCache(productCaches, row.product);
    cache.timestamps.push(row.timestamp);
    // FIXME: if the midprice is NONE calculate it (?)
    cache.midPrice.push([row.timestamp, row.midPrice]);
    cache.pnl.push([row.timestamp, row.profitLoss]);

    // FIXME: check orders and index? (should be correct)
    for (let i = 0; i < Math.min(3, row.bidPrices.length); i++) {
      cache.bidSeries[2 - i].push([row.timestamp, row.bidPrices[i]]);
    }
    for (let i = 0; i < Math.min(3, row.askPrices.length); i++) {
      cache.askSeries[i].push([row.timestamp, row.askPrices[i]]);
    }
  }

  for (const classifiedTrade of classifiedTrades) {
    const product = classifiedTrade.trade.symbol;
    const cache = ensureCache(productCaches, product);
    addClassifiedTradeToCache(cache, classifiedTrade);
  }

  for (const cache of Object.values(productCaches)) {
    cache.timestamps.sort((a, b) => a - b);
    cache.ownTakeTrades.sort((a, b) => a.classifiedTrade.trade.timestamp - b.classifiedTrade.trade.timestamp);
    cache.ownMakeTrades.sort((a, b) => a.classifiedTrade.trade.timestamp - b.classifiedTrade.trade.timestamp);
    cache.marketTrades.sort((a, b) => a.classifiedTrade.trade.timestamp - b.classifiedTrade.trade.timestamp);
  }

  return productCaches;
}

export function getDisplayedTrades(
  cache: ProductSeriesCache | null,
  filters: DashboardFiltersState,
): {
  filteredOwnTakeTrades: DashboardTradePoint[];
  filteredOwnMakeTrades: DashboardTradePoint[];
  filteredMarketTrades: DashboardTradePoint[];
  displayedTrades: DashboardTradePoint[];
} {
  if (!cache) {
    return { filteredOwnTakeTrades: [], filteredOwnMakeTrades: [], filteredMarketTrades: [], displayedTrades: [] };
  }

  const includeIds = parseTraderIdList(filters.includeTraderIds);
  const excludeIds = parseTraderIdList(filters.excludeTraderIds);

  const filteredOwnTakeTrades = cache.ownTakeTrades.filter(point =>
    includeTrade(point, includeIds, excludeIds, filters.minQuantity, filters.maxQuantity),
  );
  const filteredOwnMakeTrades = cache.ownMakeTrades.filter(point =>
    includeTrade(point, includeIds, excludeIds, filters.minQuantity, filters.maxQuantity),
  );
  const filteredMarketTrades = cache.marketTrades.filter(point =>
    includeTrade(point, includeIds, excludeIds, filters.minQuantity, filters.maxQuantity),
  );

  const displayedTrades: DashboardTradePoint[] = [];
  if (filters.showOwnTrades) {
    displayedTrades.push(...filteredOwnTakeTrades);
    displayedTrades.push(...filteredOwnMakeTrades);
  }
  if (filters.showMarketTrades) displayedTrades.push(...filteredMarketTrades);

  return { filteredOwnTakeTrades, filteredOwnMakeTrades, filteredMarketTrades, displayedTrades };
}

export function getTradesAtTimestamp(trades: DashboardTradePoint[], timestamp: number): DashboardTradePoint[] {
  return trades.filter(point => point.classifiedTrade.trade.timestamp === timestamp);
}

export function formatTradeLine(point: DashboardTradePoint): string {
  const { trade } = point.classifiedTrade;
  return `${point.executionType.toUpperCase()} ${point.quantity}@${formatNumber(trade.price)} (${trade.buyer} -> ${trade.seller})`;
}

export function formatTradeHoverFields(point: DashboardTradePoint): string {
  const { trade } = point.classifiedTrade;
  return [
    `price: <b>${formatNumber(trade.price)}</b>`,
    `quantity: <b>${formatNumber(point.quantity)}</b>`,
    `buyer: <b>${trade.buyer}</b>`,
    `seller: <b>${trade.seller}</b>`,
  ].join('<br/>');
}

export function getTradeMarkerRadiusDelta(quantity: number): number {
  if (quantity <= 3) {
    return 0;
  }

  return 2 * Math.ceil((quantity - 3) / 3);
}

export function toScatterData(points: DashboardTradePoint[]): Highcharts.PointOptionsObject[] {
  return points.map(point => ({
    x: point.classifiedTrade.trade.timestamp,
    y: point.classifiedTrade.trade.price,
    custom: point,
  }));
}
