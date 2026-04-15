import { ClassifiedTrade } from '../../models.ts';

export type TradeExecutionType = 'own_take' | 'own_make' | 'market';

export interface DashboardTradePoint {
  classifiedTrade: ClassifiedTrade;
  executionType: TradeExecutionType;
  quantity: number;
}

export type XYPoint = [number, number];

export interface ProductSeriesCache {
  product: string;
  timestamps: number[];
  midPrice: XYPoint[];
  bidSeries: XYPoint[][];
  askSeries: XYPoint[][];
  pnl: XYPoint[];
  ownTakeTrades: DashboardTradePoint[];
  ownMakeTrades: DashboardTradePoint[];
  marketTrades: DashboardTradePoint[];
}

export interface MidPriceAdvancedFilters {
  enabled: boolean;
  bidAskSpread: number;
}

export interface MidPriceFilters {
  show: boolean;
  dropZeroPoints: boolean;
  advanced: MidPriceAdvancedFilters;
}

export interface DashboardFiltersState {
  showOrderBookLevels: boolean;
  showOwnTrades: boolean;
  showMarketTrades: boolean;
  scaleTradeMarkersByVolume: boolean;
  midPrice: MidPriceFilters;
  showPnlOverlay: boolean;
  minQuantity: number;
  maxQuantity: number;
  includeTraderIds: string;
  excludeTraderIds: string;
  maxPoints: number;
}
