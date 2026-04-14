import Highcharts from 'highcharts';
import { ActivityLogRow, AlgorithmDataRow, ClassifiedTrade } from '../../models.ts';
import { formatNumber } from '../../utils/format.ts';
import {
  DashboardFiltersState,
  ProductSeriesCache,
  TradePoint,
  TradePointMeta,
  TradeTooltipMeta,
} from './dashboardTypes.ts';

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
  meta: TradePointMeta,
  includeIds: Set<string>,
  excludeIds: Set<string>,
  minQty: number,
  maxQty: number,
): boolean {
  if (meta.quantity < minQty || meta.quantity > maxQty) {
    return false;
  }

  if (excludeIds.has(meta.buyer) || excludeIds.has(meta.seller)) {
    return false;
  }

  if (includeIds.size === 0) {
    return true;
  }

  return includeIds.has(meta.buyer) || includeIds.has(meta.seller);
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
      position: [],
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
    cache.marketTrades.push([
      trade.timestamp,
      trade.price,
      {
        side: 'market',
        executionType: 'market',
        buyer: trade.buyer,
        seller: trade.seller,
        quantity,
        price: trade.price,
      },
    ]);
    return;
  }

  const takeQty = Math.max(0, Math.abs(classifiedTrade.takeQty ?? 0));
  const makeQty = Math.max(0, Math.abs(classifiedTrade.makeQty ?? quantity - takeQty));

  if (takeQty > 0) {
    cache.ownTakeTrades.push([
      trade.timestamp,
      trade.price,
      {
        side: 'own',
        executionType: 'own_take',
        buyer: trade.buyer,
        seller: trade.seller,
        quantity: takeQty,
        price: trade.price,
        takeQty,
        makeQty,
        bookMatchedQty: takeQty,
      },
    ]);
  }

  if (makeQty > 0) {
    cache.ownMakeTrades.push([
      trade.timestamp,
      trade.price,
      {
        side: 'own',
        executionType: 'own_make',
        buyer: trade.buyer,
        seller: trade.seller,
        quantity: makeQty,
        price: trade.price,
        takeQty,
        makeQty,
        bookMatchedQty: takeQty,
      },
    ]);
  }
}

export function collectProductSeries(
  algorithmRows: AlgorithmDataRow[],
  activityLogs: ActivityLogRow[],
  classifiedTrades: ClassifiedTrade[],
): Record<string, ProductSeriesCache> {
  const productCaches: Record<string, ProductSeriesCache> = {};

  for (const row of activityLogs) {
    const cache = ensureCache(productCaches, row.product);
    cache.timestamps.push(row.timestamp);
    cache.midPrice.push([row.timestamp, row.midPrice]);
    cache.pnl.push([row.timestamp, row.profitLoss]);

    for (let i = 0; i < Math.min(3, row.bidPrices.length); i++) {
      cache.bidSeries[2 - i].push([row.timestamp, row.bidPrices[i]]);
    }
    for (let i = 0; i < Math.min(3, row.askPrices.length); i++) {
      cache.askSeries[i].push([row.timestamp, row.askPrices[i]]);
    }
  }

  for (const row of algorithmRows) {
    const timestamp = row.state.timestamp;
    for (const [product, position] of Object.entries(row.state.position)) {
      ensureCache(productCaches, product).position.push([timestamp, position]);
    }
  }

  for (const classifiedTrade of classifiedTrades) {
    const product = classifiedTrade.trade.symbol;
    const cache = ensureCache(productCaches, product);
    addClassifiedTradeToCache(cache, classifiedTrade);
  }

  for (const cache of Object.values(productCaches)) {
    cache.timestamps.sort((a, b) => a - b);
    cache.position.sort((a, b) => a[0] - b[0]);
    cache.ownTakeTrades.sort((a, b) => a[0] - b[0]);
    cache.ownMakeTrades.sort((a, b) => a[0] - b[0]);
    cache.marketTrades.sort((a, b) => a[0] - b[0]);
  }

  return productCaches;
}

export function getDisplayedTrades(
  cache: ProductSeriesCache | null,
  filters: DashboardFiltersState,
): {
  filteredOwnTakeTrades: TradePoint[];
  filteredOwnMakeTrades: TradePoint[];
  filteredMarketTrades: TradePoint[];
  displayedTrades: TradePoint[];
} {
  if (!cache) {
    return { filteredOwnTakeTrades: [], filteredOwnMakeTrades: [], filteredMarketTrades: [], displayedTrades: [] };
  }

  const includeIds = parseTraderIdList(filters.includeTraderIds);
  const excludeIds = parseTraderIdList(filters.excludeTraderIds);

  const filteredOwnTakeTrades = cache.ownTakeTrades.filter(point =>
    includeTrade(point[2], includeIds, excludeIds, filters.minQuantity, filters.maxQuantity),
  );
  const filteredOwnMakeTrades = cache.ownMakeTrades.filter(point =>
    includeTrade(point[2], includeIds, excludeIds, filters.minQuantity, filters.maxQuantity),
  );
  const filteredMarketTrades = cache.marketTrades.filter(point =>
    includeTrade(point[2], includeIds, excludeIds, filters.minQuantity, filters.maxQuantity),
  );

  const displayedTrades: TradePoint[] = [];
  if (filters.showOwnTrades) {
    displayedTrades.push(...filteredOwnTakeTrades);
    displayedTrades.push(...filteredOwnMakeTrades);
  }
  if (filters.showMarketTrades) displayedTrades.push(...filteredMarketTrades);

  return { filteredOwnTakeTrades, filteredOwnMakeTrades, filteredMarketTrades, displayedTrades };
}

export function getTradesAtTimestamp(trades: TradePoint[], timestamp: number): TradePointMeta[] {
  return trades.filter(point => point[0] === timestamp).map(point => point[2]);
}

export function formatTradeLine(meta: TradePointMeta): string {
  return `${meta.executionType.toUpperCase()} ${meta.quantity}@${formatNumber(meta.price)} (${meta.buyer} -> ${meta.seller})`;
}

export function formatTradeHoverFields(meta: TradeTooltipMeta): string {
  return [
    `price: <b>${formatNumber(meta.price)}</b>`,
    `quantity: <b>${formatNumber(meta.quantity)}</b>`,
    `buyer: <b>${meta.buyer}</b>`,
    `seller: <b>${meta.seller}</b>`,
  ].join('<br/>');
}

export function formatProductLogs(row: AlgorithmDataRow, product: string): string {
  const result: string[] = [];
  const keyword = product.toLowerCase();

  const pushFilteredLines = (header: string, body: string): void => {
    if (!body.trim()) {
      return;
    }
    const filtered = body
      .split('\n')
      .filter(line => line.toLowerCase().includes(keyword))
      .slice(0, 120);
    if (filtered.length === 0) {
      return;
    }
    result.push(`${header}:`);
    result.push(...filtered);
    result.push('');
  };

  pushFilteredLines('Algorithm logs', row.algorithmLogs ?? '');
  pushFilteredLines('Sandbox logs', row.sandboxLogs ?? '');

  if (result.length === 0) {
    return 'No product-scoped log lines at this timestamp.';
  }

  return result.join('\n');
}

export function toScatterData(points: TradePoint[]): Highcharts.PointOptionsObject[] {
  const getRadius = (quantity: number): number => {
    const radius = 3 + Math.sqrt(Math.max(0, quantity));
    return Math.max(3, Math.min(14, radius));
  };

  return points.map(point => ({
    x: point[0],
    y: point[1],
    custom: { ...point[2], timestamp: point[0] },
    marker: point[2].executionType === 'market' ? { radius: getRadius(point[2].quantity) } : undefined,
  }));
}
