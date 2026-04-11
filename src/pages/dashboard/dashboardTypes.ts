import { SeriesScatterOptions } from 'highcharts';

export type TradeExecutionType = 'own_take' | 'own_make' | 'market';

export interface TradePointMeta {
  side: 'own' | 'market';
  executionType: TradeExecutionType;
  buyer: string;
  seller: string;
  quantity: number;
  price: number;
  takeQty?: number;
  makeQty?: number;
  bookMatchedQty?: number;
}

export interface TradeTooltipMeta extends TradePointMeta {
  timestamp: number;
}

export type TradePoint = [number, number, TradePointMeta];
export type XYPoint = [number, number];

export interface ProductSeriesCache {
  product: string;
  timestamps: number[];
  midPrice: XYPoint[];
  bidSeries: XYPoint[][];
  askSeries: XYPoint[][];
  pnl: XYPoint[];
  position: XYPoint[];
  ownTakeTrades: TradePoint[];
  ownMakeTrades: TradePoint[];
  marketTrades: TradePoint[];
}

export interface DashboardFiltersState {
  showOrderBookLevels: boolean;
  showOwnTrades: boolean;
  showMarketTrades: boolean;
  showMidPrice: boolean;
  showPnlOverlay: boolean;
  showPositionOverlay: boolean;
  minQuantity: number;
  maxQuantity: number;
  includeTraderIds: string;
  excludeTraderIds: string;
  maxPoints: number;
}

export type TradeScatterSeries = SeriesScatterOptions & {
  data: Array<{ x: number; y: number; custom: TradePointMeta }>;
};
