// @ts-nocheck
import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, X, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  visible: boolean;
  order: number;
  size?: 'sm' | 'md' | 'lg' | 'full';
  config?: Record<string, unknown>;
}

interface WidgetCustomizerProps {
  widgets: DashboardWidget[];
  onSave: (widgets: DashboardWidget[]) => void;
  onClose: () => void;
}

function SortableWidget({ widget, onToggleVisibility }: { widget: DashboardWidget; onToggleVisibility: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-3 p-3 bg-base-200 rounded-lg border border-base-300',
        isDragging && 'shadow-lg'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-primary"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-1">
        <span className="font-medium">{widget.title}</span>
        <span className={clsx('text-xs ml-2', widget.visible ? 'text-success' : 'text-gray-500')}>
          {widget.visible ? 'Visible' : 'Hidden'}
        </span>
      </div>

      <button
        onClick={() => onToggleVisibility(widget.id)}
        className={clsx('btn btn-sm btn-ghost', !widget.visible && 'text-gray-500')}
      >
        {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function WidgetCustomizer({ widgets, onSave, onClose }: WidgetCustomizerProps) {
  const [localWidgets, setLocalWidgets] = useState(widgets);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleVisibility = (id: string) => {
    setLocalWidgets(prev =>
      prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setLocalWidgets(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, i) => ({ ...item, order: i }));
      });
    }
  };

  const handleSave = () => {
    onSave(localWidgets);
    toast.success('Dashboard layout saved');
    onClose();
  };

  const resetToDefault = () => {
    setLocalWidgets(widgets.map((w, i) => ({ ...w, visible: true, order: i })));
    toast.info('Layout reset to default');
  };

  const availableWidgets: DashboardWidget[] = [
    { id: 'stats-overview', type: 'stats', title: 'Stats Overview', visible: true, order: 0 },
    { id: 'projects-summary', type: 'projects', title: 'Projects Summary', visible: true, order: 1 },
    { id: 'activity-feed', type: 'activity', title: 'Activity Feed', visible: true, order: 2 },
    { id: 'upcoming-deadlines', type: 'deadlines', title: 'Upcoming Deadlines', visible: true, order: 3 },
    { id: 'safety-alerts', type: 'safety', title: 'Safety Alerts', visible: true, order: 4 },
    { id: 'team-availability', type: 'team', title: 'Team Availability', visible: true, order: 5 },
    { id: 'invoice-status', type: 'invoices', title: 'Invoice Status', visible: true, order: 6 },
    { id: 'budget-tracking', type: 'budget', title: 'Budget Tracking', visible: true, order: 7 },
    { id: 'recent-documents', type: 'documents', title: 'Recent Documents', visible: true, order: 8 },
    { id: 'ai-insights', type: 'ai', title: 'AI Insights', visible: true, order: 9 },
  ];

  const addWidget = (widget: DashboardWidget) => {
    setLocalWidgets(prev => [
      ...prev,
      { ...widget, visible: true, order: prev.length }
    ]);
    toast.success(`Added ${widget.title}`);
  };

  const notAddedWidgets = availableWidgets.filter(
    aw => !localWidgets.find(lw => lw.id === aw.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card bg-base-100 w-full max-w-2xl m-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="card-body">
          <div className="flex justify-between items-center">
            <h2 className="card-title">Customize Dashboard</h2>
            <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-500">
            Drag and drop to reorder widgets. Toggle visibility with the eye icon.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-2 my-4">
              <SortableContext items={localWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
                {localWidgets.map(widget => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onToggleVisibility={toggleVisibility}
                  />
                ))}
              </SortableContext>
            </div>

            <DragOverlay>
              {activeId ? (
                <div className="p-3 bg-primary text-primary-content rounded-lg shadow-lg">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-5 h-5" />
                    <span>
                      {localWidgets.find(w => w.id === activeId)?.title}
                    </span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {notAddedWidgets.length > 0 && (
            <div className="divider">Add Widgets</div>
          )}

          {notAddedWidgets.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {notAddedWidgets.map(widget => (
                <button
                  key={widget.id}
                  onClick={() => addWidget(widget)}
                  className="btn btn-sm btn-outline gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {widget.title}
                </button>
              ))}
            </div>
          )}

          <div className="card-actions justify-end mt-4">
            <button onClick={resetToDefault} className="btn btn-ghost">
              Reset to Default
            </button>
            <button onClick={handleSave} className="btn btn-primary">
              <Check className="w-4 h-4" />
              Save Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
