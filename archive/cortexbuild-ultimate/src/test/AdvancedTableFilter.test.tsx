import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdvancedTableFilter } from '../components/ui/AdvancedTableFilter';

describe('AdvancedTableFilter', () => {
  const mockColumns = [
    { key: 'name', label: 'Name', type: 'text' as const },
    { key: 'status', label: 'Status', type: 'select' as const },
    { key: 'value', label: 'Value', type: 'number' as const },
  ];

  it('renders search and filter buttons', () => {
    render(
      <AdvancedTableFilter
        columns={mockColumns}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    expect(screen.getByPlaceholderText('Quick search...')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('opens filter panel when clicked', () => {
    render(
      <AdvancedTableFilter
        columns={mockColumns}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Filters'));
    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
  });

  it('allows adding filters', () => {
    render(
      <AdvancedTableFilter
        columns={mockColumns}
        onFilterChange={() => {}}
        onClear={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByText('Add Filter'));
    
    expect(screen.getByText('Contains')).toBeInTheDocument();
  });

});
