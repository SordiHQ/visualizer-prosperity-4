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
          onChange={event => setFilters(prev => ({ ...prev, includeTraderIds: event.currentTarget.value }))}
        />
        <TextInput
          label="Exclude trader IDs (CSV)"
          placeholder="charlie"
          value={filters.excludeTraderIds}
          onChange={event => setFilters(prev => ({ ...prev, excludeTraderIds: event.currentTarget.value }))}
        />

        <NumberInput
          label="Point cap per series"
          value={filters.maxPoints}
          onChange={value =>
            setFilters(prev => ({ ...prev, maxPoints: typeof value === 'number' ? Math.max(300, value) : 5000 }))
          }
          min={300}
          step={250}
          allowDecimal={false}
        />

        <Checkbox
          label="Show order book levels"
          checked={filters.showOrderBookLevels}
          onChange={event => setFilters(prev => ({ ...prev, showOrderBookLevels: event.currentTarget.checked }))}
        />
        <Checkbox
          label="Show own trades"
          checked={filters.showOwnTrades}
          onChange={event => setFilters(prev => ({ ...prev, showOwnTrades: event.currentTarget.checked }))}
        />
        <Checkbox
          label="Show market trades"
          checked={filters.showMarketTrades}
          onChange={event => setFilters(prev => ({ ...prev, showMarketTrades: event.currentTarget.checked }))}
        />
        <Checkbox
          label="Show mid price"
          checked={filters.showMidPrice}
          onChange={event => setFilters(prev => ({ ...prev, showMidPrice: event.currentTarget.checked }))}
        />
        <Checkbox
          label="Overlay product P/L"
          checked={filters.showPnlOverlay}
          onChange={event => setFilters(prev => ({ ...prev, showPnlOverlay: event.currentTarget.checked }))}
        />
        <Checkbox
          label="Overlay position"
          checked={filters.showPositionOverlay}
          onChange={event => setFilters(prev => ({ ...prev, showPositionOverlay: event.currentTarget.checked }))}
        />
      </Stack>
    </VisualizerCard>
  );
}
