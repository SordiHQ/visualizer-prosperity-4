import {
  ActivityLogRow,
  AlgorithmDataRow,
  CompressedAlgorithmDataRow,
  CompressedListing,
  CompressedObservations,
  CompressedOrder,
  CompressedOrderDepth,
  CompressedTrade,
  CompressedTradingState,
  ConversionObservation,
  Listing,
  Observation,
  Order,
  OrderDepth,
  ParsedJsonLogs,
  Product,
  ProsperitySymbol,
  Trade,
  TradingState,
} from '../models.ts';

export function extractJsonLogs(logs: string): ParsedJsonLogs {
  try {
    const parsed = typeof logs === 'string' ? JSON.parse(logs) : logs;
    if (typeof parsed?.activitiesLog === 'string') {
      return parsed as ParsedJsonLogs;
    }
  } catch {
    // Not JSON payload, ignore.
  }
  return {
    activitiesLog: '',
  };
}

export function getActivityLogsFromParsedJson(logs: ParsedJsonLogs): ActivityLogRow[] {
  if (logs === null || typeof logs.activitiesLog !== 'string' || logs.activitiesLog.trim().length === 0) {
    return [];
  }

  return logs.activitiesLog
    .split(/\r?\n/)
    .filter((line, index) => index > 0 && line.trim().length > 0)
    .map(line => {
      const columns = line.split(';');
      return {
        day: Number(columns[0]),
        timestamp: Number(columns[1]),
        product: columns[2],
        bidPrices: getColumnValues(columns, [3, 5, 7]),
        bidVolumes: getColumnValues(columns, [4, 6, 8]),
        askPrices: getColumnValues(columns, [9, 11, 13]),
        askVolumes: getColumnValues(columns, [10, 12, 14]),
        midPrice: Number(columns[15]),
        profitLoss: Number(columns[16]),
      };
    })
    .map(row => {
      if (
        !Number.isFinite(row.day) ||
        !Number.isFinite(row.timestamp) ||
        typeof row.product !== 'string' ||
        row.product.length === 0
      ) {
        throw new Error(`Invalid activity log row detected: ${JSON.stringify(row)}`);
      }
      return row;
    });
}

function getColumnValues(columns: string[], indices: number[]): number[] {
  const values: number[] = [];

  for (const index of indices) {
    const value = columns[index];
    if (value !== '') {
      values.push(parseFloat(value));
    }
  }

  return values;
}

function decompressListings(compressed: CompressedListing[]): Record<ProsperitySymbol, Listing> {
  const listings: Record<ProsperitySymbol, Listing> = {};

  for (const [symbol, product, denomination] of compressed) {
    listings[symbol] = {
      symbol,
      product,
      // This year some payloads encode denomination as numeric token (e.g. 1).
      // Normalize to string to keep the public Listing model stable.
      denomination: String(denomination),
    };
  }

  return listings;
}

function decompressOrderDepths(
  compressed: Record<ProsperitySymbol, CompressedOrderDepth>,
): Record<ProsperitySymbol, OrderDepth> {
  const orderDepths: Record<ProsperitySymbol, OrderDepth> = {};

  for (const [symbol, [buyOrders, sellOrders]] of Object.entries(compressed)) {
    orderDepths[symbol] = {
      buyOrders,
      sellOrders,
    };
  }

  return orderDepths;
}

function decompressTrades(compressed: CompressedTrade[]): Record<ProsperitySymbol, Trade[]> {
  const trades: Record<ProsperitySymbol, Trade[]> = {};

  for (const [symbol, price, quantity, buyer, seller, timestamp] of compressed) {
    if (trades[symbol] === undefined) {
      trades[symbol] = [];
    }

    trades[symbol].push({
      symbol: symbol,
      // currency: 'NaN', // FIXME: correct this, hardocded because not important here
      price: price,
      quantity: quantity,
      buyer: buyer,
      seller: seller,
      timestamp: timestamp,
    });
  }

  return trades;
}

function decompressObservations(compressed: CompressedObservations): Observation {
  const conversionObservations: Record<Product, ConversionObservation> = {};

  for (const [
    product,
    [bidPrice, askPrice, transportFees, exportTariff, importTariff, sugarPrice, sunlightIndex],
  ] of Object.entries(compressed[1])) {
    conversionObservations[product] = {
      bidPrice,
      askPrice,
      transportFees,
      exportTariff,
      importTariff,
      sugarPrice,
      sunlightIndex,
    };
  }

  return {
    plainValueObservations: compressed[0],
    conversionObservations,
  };
}

function decompressState(compressed: CompressedTradingState): TradingState {
  return {
    timestamp: compressed[0],
    traderData: compressed[1],
    listings: decompressListings(compressed[2]),
    orderDepths: decompressOrderDepths(compressed[3]),
    ownTrades: decompressTrades(compressed[4]),
    marketTrades: decompressTrades(compressed[5]),
    position: compressed[6],
    observations: decompressObservations(compressed[7]),
  };
}

function decompressOrders(compressed: CompressedOrder[]): Record<ProsperitySymbol, Order[]> {
  const orders: Record<ProsperitySymbol, Order[]> = {};

  for (const [symbol, price, quantity] of compressed) {
    if (orders[symbol] === undefined) {
      orders[symbol] = [];
    }

    orders[symbol].push({
      symbol,
      price,
      quantity,
    });
  }

  return orders;
}

type ParsedLambdaLog = Omit<AlgorithmDataRow, 'sandboxLogs'>;

function decompressDataRow(compressed: CompressedAlgorithmDataRow): ParsedLambdaLog {
  return {
    state: decompressState(compressed[0]),
    orders: decompressOrders(compressed[1]),
    conversions: compressed[2],
    traderData: compressed[3],
    algorithmLogs: compressed[4],
  };
}

export function parseSandboxLog(sandboxLog?: string): { text: string; isConversionRequest: boolean } {
  const text = typeof sandboxLog === 'string' ? sandboxLog.trim() : '';
  return {
    text,
    isConversionRequest: text.startsWith('Conversion request'),
  };
}

export function parseLambdaLog(lambdaLog?: string): ParsedLambdaLog | null {
  if (typeof lambdaLog !== 'string' || lambdaLog.trim().length === 0) {
    return null;
  }

  try {
    const compressedDataRow = JSON.parse(lambdaLog) as CompressedAlgorithmDataRow;
    return decompressDataRow(compressedDataRow);
  } catch (err) {
    throw new Error(`Invalid lambdaLog payload: ${String(err)}`);
  }
}

export function getAlgorithmDataFromJson(allLogs: ParsedJsonLogs): AlgorithmDataRow[] {
  const rows: AlgorithmDataRow[] = [];
  const algoLogs = allLogs.logs ?? [];
  let nextSandboxLogs = '';

  for (const logRow of algoLogs) {
    const parsedSandboxLog = parseSandboxLog(logRow.sandboxLog);

    if (parsedSandboxLog.isConversionRequest) {
      const lastRow = rows[rows.length - 1];
      if (lastRow !== undefined) {
        lastRow.sandboxLogs += (lastRow.sandboxLogs.length > 0 ? '\n' : '') + parsedSandboxLog.text;
      }
      nextSandboxLogs = '';
    } else {
      nextSandboxLogs = parsedSandboxLog.text;
    }

    const parsedLambdaLog = parseLambdaLog(logRow.lambdaLog);
    if (parsedLambdaLog === null) {
      continue;
    }

    rows.push({
      ...parsedLambdaLog,
      sandboxLogs: nextSandboxLogs,
    });
    nextSandboxLogs = '';
  }

  return rows;
}

export function getMarketTradesFromJson(allLogs: ParsedJsonLogs): Trade[] {
  return allLogs.tradeHistory ?? [];
}
