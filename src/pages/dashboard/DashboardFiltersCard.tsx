import { Checkbox, Divider, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { ReactNode } from 'react';
import { VisualizerCard } from '../visualizer/VisualizerCard.tsx';
import { DashboardFiltersState } from './dashboardTypes.ts';

interface DashboardFiltersCardProps {
  products: string[];
  selectedProduct: string | null;
  setSelectedProduct: (product: string | null) => void;
  filters: DashboardFiltersState;
  setFilters: (updater: (prev: DashboardFiltersState) => DashboardFiltersState) => void;
}

export function DashboardFiltersCard({
  products,
  selectedProduct,
  setSelectedProduct,
  filters,
  setFilters,
}: DashboardFiltersCardProps): ReactNode {
  return (
    <VisualizerCard title="Selection & Filters">
      <Stack gap="sm">
        <Select
          label="Product"
          data={products.map(product => ({ value: product, label: product }))}
          value={selectedProduct}
          onChange={setSelectedProduct}
          searchable
        />

        <Divider />
        <Text fw={600} size="sm">
          Trades
        </Text>
        <Group grow>
          <NumberInput
            label="Min qty"
            value={filters.minQuantity}
            onChange={value => setFilters(prev => ({ ...prev, minQuantity: typeof value === 'number' ? value : 0 }))}
            min={0}
            allowDecimal={false}
          />
          <NumberInput
            label="Max qty"
            value={filters.maxQuantity}
            onChange={value =>
              setFilters(prev => ({ ...prev, maxQuantity: typeof value === 'number' ? value : 100000 }))
            }
            min={0}
            allowDecimal={false}
          />
        </Group>
        <Checkbox
          label="Scale trade marker size by volume"
          checked={filters.scaleTradeMarkersByVolume}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, scaleTradeMarkersByVolume: checked }));
          }}
        />
        <TextInput
          label="Include trader IDs (CSV)"
          placeholder="alice,bob"
          value={filters.includeTraderIds}
          onChange={event => {
            const value = event.currentTarget.value;
            setFilters(prev => ({ ...prev, includeTraderIds: value }));
          }}
        />
        <TextInput
          label="Exclude trader IDs (CSV)"
          placeholder="charlie"
          value={filters.excludeTraderIds}
          onChange={event => {
            const value = event.currentTarget.value;
            setFilters(prev => ({ ...prev, excludeTraderIds: value }));
          }}
        />

        <Divider />
        <Text fw={600} size="sm">
          Filters
        </Text>
        <Checkbox
          label="Show order book levels"
          checked={filters.showOrderBookLevels}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, showOrderBookLevels: checked }));
          }}
        />
        <Checkbox
          label="Show own trades"
          checked={filters.showOwnTrades}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, showOwnTrades: checked }));
          }}
        />
        <Checkbox
          label="Show market trades"
          checked={filters.showMarketTrades}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, showMarketTrades: checked }));
          }}
        />
        <Checkbox
          label="Show mid price"
          checked={filters.midPrice.show}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, midPrice: { ...prev.midPrice, show: checked } }));
          }}
        />
        <Checkbox
          label="Drop zero mid price points"
          checked={filters.midPrice.dropZeroPoints}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, midPrice: { ...prev.midPrice, dropZeroPoints: checked } }));
          }}
        />
        {filters.midPrice.dropZeroPoints && (
          <Stack gap="xs" ml="md">
            <Checkbox
              label="Advanced mid-price fill"
              checked={filters.midPrice.advanced.enabled}
              onChange={event => {
                const checked = event.currentTarget.checked;
                setFilters(prev => ({
                  ...prev,
                  midPrice: {
                    ...prev.midPrice,
                    advanced: {
                      ...prev.midPrice.advanced,
                      enabled: checked,
                    },
                  },
                }));
              }}
            />
            {filters.midPrice.advanced.enabled && (
              <NumberInput
                label="BID_ASK_SPREAD"
                value={filters.midPrice.advanced.bidAskSpread}
                onChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    midPrice: {
                      ...prev.midPrice,
                      advanced: {
                        ...prev.midPrice.advanced,
                        bidAskSpread: typeof value === 'number' ? value : 0,
                      },
                    },
                  }))
                }
                min={0}
                allowDecimal
                decimalScale={4}
              />
            )}
          </Stack>
        )}
        <Checkbox
          label="Overlay product P/L"
          checked={filters.showPnlOverlay}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, showPnlOverlay: checked }));
          }}
        />
      </Stack>
    </VisualizerCard>
  );
}
