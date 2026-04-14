import { ActivityLogRow, ClassifiedTrade, Trade } from '../models';

export function classifyMarketTrades(activityLogs: ActivityLogRow[], tradeHistory: Trade[]): ClassifiedTrade[] {
  const classifiedTrades: ClassifiedTrade[] = [];
  for (const trade of tradeHistory) {
    // check in the orderBook at time t
    if (isOwnTrade(trade)) {
      const { takeQty, makeQty } = getTakeMakeQty(trade, activityLogs);
      classifiedTrades.push({
        trade: trade,
        side: 'own',
        takeQty: takeQty,
        makeQty: makeQty,
      });
    } else {
      classifiedTrades.push({
        trade: trade,
        side: 'market',
      });
    }
  }
  return classifiedTrades;
}

function isOwnTrade(trade: Trade): boolean {
  return trade.buyer === 'SUBMISSION' || trade.seller === 'SUBMISSION';
}

function getTakeMakeQty(ownTrade: Trade, activityLogs: ActivityLogRow[]): { takeQty: number; makeQty: number } {
  const activityLog = activityLogs.find(log => log.timestamp === ownTrade.timestamp && log.product === ownTrade.symbol);

  if (activityLog === undefined) {
    return { takeQty: 0, makeQty: ownTrade.quantity };
  }

  // seller === SUBMISSION means we sold into bids (taking bid-side liquidity).
  if (ownTrade.seller === 'SUBMISSION') {
    const priceIndex = activityLog.bidPrices.indexOf(ownTrade.price);
    const takeQty = priceIndex >= 0 ? Math.min(activityLog.bidVolumes[priceIndex] ?? 0, ownTrade.quantity) : 0;
    return { takeQty, makeQty: ownTrade.quantity - takeQty };
  }

  // buyer === SUBMISSION means we bought from asks (taking ask-side liquidity).
  if (ownTrade.buyer === 'SUBMISSION') {
    const priceIndex = activityLog.askPrices.indexOf(ownTrade.price);
    const takeQty = priceIndex >= 0 ? Math.min(activityLog.askVolumes[priceIndex] ?? 0, ownTrade.quantity) : 0;
    return { takeQty, makeQty: ownTrade.quantity - takeQty };
  }

  return { takeQty: 0, makeQty: ownTrade.quantity };
}
