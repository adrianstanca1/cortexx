import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

interface ColumnFilter {
  column: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'gt' | 'lt';
  value: string;
}

interface AdvancedTableFilterProps {
  columns: { key: string; label: string; type?: 'text' | 'number' | 'select'; options?: string[] }[];
  onFilterChange: (filters: ColumnFilter[]) => void;
  onClear: () => void;
}

export function AdvancedTableFilter({ columns, onFilterChange, onClear }: AdvancedTableFilterProps) {
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const addFilter = () => {
    const newFilter: ColumnFilter = {
      column: columns[0]?.key || '',
      operator: 'contains',
      value: '',
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (index: number, field: keyof ColumnFilter, value: string) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
  };

  const applyFilters = () => {
    const validFilters = filters.filter(f => f.value);
    onFilterChange(validFilters);
    setShowFilters(false);
  };

  const clearAll = () => {
    setFilters([]);
    onClear();
  };

  return (
    <div className="relative">
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Quick search..."
            className="input input-bordered w-full pl-10"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
        {filters.length > 0 && (
          <button onClick={clearAll} className="btn btn-sm btn-ghost">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showFilters && (
        <div className="card bg-base-200 p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Advanced Filters</h3>
            <button onClick={addFilter} className="btn btn-sm btn-primary">
              Add Filter
            </button>
          </div>

          {filters.map((filter, index) => (
            <div key={index} className="flex gap-2 mb-2 items-center">
              <select
                value={filter.column}
                onChange={(e) => updateFilter(index, 'column', e.target.value)}
                className="select select-bordered select-sm w-40"
              >
                {columns.map(col => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>

              <select
                value={filter.operator}
                onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                className="select select-bordered select-sm w-32"
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="startsWith">Starts with</option>
                <option value="endsWith">Ends with</option>
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
              </select>

              <input
                type="text"
                value={filter.value}
                onChange={(e) => updateFilter(index, 'value', e.target.value)}
                placeholder="Value"
                className="input input-bordered input-sm flex-1"
              />

              <button
                onClick={() => removeFilter(index)}
                className="btn btn-sm btn-ghost btn-square"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {filters.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No filters applied. Click "Add Filter" to add one.
            </p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowFilters(false)} className="btn btn-sm btn-ghost">
              Cancel
            </button>
            <button onClick={applyFilters} className="btn btn-sm btn-primary">
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
