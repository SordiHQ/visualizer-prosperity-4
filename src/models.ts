export interface UserSummary {
  id: number;
  firstName: string;
  lastName: string;
}

export interface AlgorithmSummary {
  id: string;
  content: string;
  fileName: string;
  round: string;
  selectedForRound: boolean;
  status: string;
  teamId: string;
  timestamp: string;
  graphLog: string;
  user: UserSummary;
}

export type Time = number;
export type ProsperitySymbol = string;
export type ProsperityCurrency = string;
export type Product = string;
export type Position = number;
export type UserId = string;
export type ObservationValue = number;

export interface AlgoLogs {
  sandboxLog?: string;
  lambdaLog?: string;
  timestamp?: number;
}

export interface ParsedJsonLogs {
  submissionId?: string;
  activitiesLog: string;
  logs?: Array<AlgoLogs>;
  tradeHistory?: Array<Trade>;
}

export interface ActivityLogRow {
  day: number;
  timestamp: number;
  product: Product;
  bidPrices: number[];
  bidVolumes: number[];
  askPrices: number[];
  askVolumes: number[];
  midPrice: number;
  profitLoss: number;
}

export interface Listing {
  symbol: ProsperitySymbol;
  product: Product;
  denomination: Product;
}

// this is not used in this first round
// FIXME: see if it could be useful in the next rounds
export interface ConversionObservation {
  bidPrice: number;
  askPrice: number;
  transportFees: number;
  exportTariff: number;
  importTariff: number;
  sugarPrice: number;
  sunlightIndex: number;
}

// this is not used in this first round
// FIXME: see if it could be useful in the next rounds
export interface Observation {
  plainValueObservations: Record<Product, ObservationValue>;
  conversionObservations: Record<Product, ConversionObservation>;
}

export interface Order {
  symbol: ProsperitySymbol;
  price: number;
  quantity: number;
}

export interface OrderDepth {
  buyOrders: Record<number, number>;
  sellOrders: Record<number, number>;
}

export interface Trade {
  timestamp: Time;
  buyer: UserId;
  seller: UserId;
  symbol: ProsperitySymbol;
  currency?: ProsperityCurrency;
  price: number;
  quantity: number;
}
export interface ClassifiedTrade {
  trade: Trade;
  side: 'own' | 'market';
  takeQty?: number;
  makeQty?: number;
}

export interface TradingState {
  timestamp: Time;
  traderData: string;
  listings: Record<ProsperitySymbol, Listing>;
  orderDepths: Record<ProsperitySymbol, OrderDepth>;
  ownTrades: Record<ProsperitySymbol, Trade[]>; // FIXME: remove this? not used for visualization (tradeHistory is used instead)
  marketTrades: Record<ProsperitySymbol, Trade[]>; // FIXME: remove this? not used for visualization (tradeHistory is used instead)
  position: Record<Product, Position>;
  observations: Observation;
}

export interface AlgorithmDataRow {
  state: TradingState; // input to Trader.run at time t
  orders: Record<ProsperitySymbol, Order[]>; // output from Trader.run at time t
  conversions: number; // output from Trader.run at time t (not used in the round0)
  traderData: string; // output from Trader.run at time t (to persist at time t+1)
  algorithmLogs: string; // output log/debug string from Trader.run at time t
  sandboxLogs: string;
}

export type AlgorithmSource = 'prosperity-submission' | 'backtester' | 'legacy-format';

export interface Algorithm {
  summary?: AlgorithmSummary;
  activityLogs: ActivityLogRow[];
  data: AlgorithmDataRow[];
  source?: AlgorithmSource;
  submissionId?: string;
  loadedFileName?: string;
  warnings?: string[];
  marketTrades: ClassifiedTrade[]; // FIXME: maybe it should be optional for backward compatibility
}

export type CompressedListing = [symbol: ProsperitySymbol, product: Product, denomination: Product | number];

export type CompressedOrderDepth = [buyOrders: Record<number, number>, sellOrders: Record<number, number>];

export type CompressedTrade = [
  symbol: ProsperitySymbol,
  price: number,
  quantity: number,
  buyer: UserId,
  seller: UserId,
  timestamp: Time,
];

export type CompressedConversionObservation = [
  bidPrice: number,
  askPrice: number,
  transportFees: number,
  exportTariff: number,
  importTariff: number,
  sugarPrice: number,
  sunlightIndex: number,
];

export type CompressedObservations = [
  plainValueObservations: Record<Product, ObservationValue>,
  conversionObservations: Record<Product, CompressedConversionObservation>,
];

export type CompressedTradingState = [
  timestamp: Time,
  traderData: string,
  listings: CompressedListing[],
  orderDepths: Record<ProsperitySymbol, CompressedOrderDepth>,
  ownTrades: CompressedTrade[],
  marketTrades: CompressedTrade[],
  position: Record<Product, Position>,
  observations: CompressedObservations,
];

export type CompressedOrder = [symbol: ProsperitySymbol, price: number, quantity: number];

export type CompressedAlgorithmDataRow = [
  state: CompressedTradingState,
  orders: CompressedOrder[],
  conversions: number,
  traderData: string,
  logs: string,
];
