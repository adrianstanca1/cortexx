interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ResponsiveGrid({ 
  children, 
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  className = ''
}: ResponsiveGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const gridClasses = `
    grid
    grid-cols-${cols.mobile || 1}
    sm:grid-cols-${cols.tablet || 2}
    lg:grid-cols-${cols.desktop || 3}
    ${gapClasses[gap]}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
}

// Mobile-first card stack
interface CardStackProps {
  children: React.ReactNode;
  expandable?: boolean;
}

export function CardStack({ children, expandable: _expandable = false }: CardStackProps) {
  return (
    <div className="flex flex-col gap-4 md:hidden">
      {children}
    </div>
  );
}
