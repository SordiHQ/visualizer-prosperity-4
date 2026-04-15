import { Checkbox, Group, NumberInput, Select, Stack, TextInput } from '@mantine/core';
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
          label="Scale trade marker size by volume"
          checked={filters.scaleTradeMarkersByVolume}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, scaleTradeMarkersByVolume: checked }));
          }}
        />
        <Checkbox
          label="Show mid price"
          checked={filters.showMidPrice}
          onChange={event => {
            const checked = event.currentTarget.checked;
            setFilters(prev => ({ ...prev, showMidPrice: checked }));
          }}
        />
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
