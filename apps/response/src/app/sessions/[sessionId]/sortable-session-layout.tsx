"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

export type SessionLayoutCardKey =
  | "transcript"
  | "summary"
  | "answers"
  | "topics"
  | "insights"
  | "followups"
  | "screen"
  | "code"
  | "systemDesign"
  | "state";

export interface SortableSessionLayoutProps {
  children(card: SessionLayoutCardKey): ReactNode;
  editing: boolean;
  highlightedCard?: SessionLayoutCardKey;
  items: SessionLayoutCardKey[];
  labels: Record<SessionLayoutCardKey, string>;
  onAnnouncement(message: string): void;
  onItemsChange(items: SessionLayoutCardKey[]): void;
}

export function SortableSessionLayout({
  children,
  editing,
  highlightedCard,
  items,
  labels,
  onAnnouncement,
  onItemsChange
}: Readonly<SortableSessionLayoutProps>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const moveItem = (card: SessionLayoutCardKey, direction: -1 | 1) => {
    const currentIndex = items.indexOf(card);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const next = arrayMove(items, currentIndex, nextIndex);
    onItemsChange(next);
    onAnnouncement(`${labels[card]} moved to position ${nextIndex + 1} of ${items.length}.`);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const card = toLayoutCardKey(active.id);
    if (card) onAnnouncement(`${labels[card]} picked up. Use arrow keys to choose a new position, then press Space to drop.`);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const activeCard = toLayoutCardKey(active.id);
    const overCard = over ? toLayoutCardKey(over.id) : undefined;
    if (!activeCard || !overCard) return;
    if (activeCard === overCard) {
      onAnnouncement(`${labels[activeCard]} stayed in position ${items.indexOf(activeCard) + 1}.`);
      return;
    }
    const oldIndex = items.indexOf(activeCard);
    const newIndex = items.indexOf(overCard);
    if (oldIndex < 0 || newIndex < 0) return;
    onItemsChange(arrayMove(items, oldIndex, newIndex));
    onAnnouncement(`${labels[activeCard]} moved to position ${newIndex + 1} of ${items.length}.`);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={() => onAnnouncement("Card movement cancelled.")}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext items={items} strategy={rectSortingStrategy}>
        {items.map((card, index) => (
          <SortableLayoutCard
            card={card}
            editing={editing}
            highlighted={highlightedCard === card}
            index={index}
            itemCount={items.length}
            key={card}
            label={labels[card]}
            onMove={moveItem}
          >
            {children(card)}
          </SortableLayoutCard>
        ))}
      </SortableContext>
    </DndContext>
  );
}

interface SortableLayoutCardProps {
  card: SessionLayoutCardKey;
  children: ReactNode;
  editing: boolean;
  highlighted: boolean;
  index: number;
  itemCount: number;
  label: string;
  onMove(card: SessionLayoutCardKey, direction: -1 | 1): void;
}

function SortableLayoutCard({
  card,
  children,
  editing,
  highlighted,
  index,
  itemCount,
  label,
  onMove
}: Readonly<SortableLayoutCardProps>) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: !editing,
    id: card
  });

  return (
    <div
      className={[
        "layout-card-shell",
        editing ? "layout-card-editing" : "",
        highlighted ? "highlighted-layout-card" : "",
        isDragging ? "layout-card-dragging" : ""
      ].filter(Boolean).join(" ")}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 5 : undefined
      }}
    >
      {editing ? (
        <div className="layout-card-toolbar">
          <button
            {...attributes}
            {...listeners}
            aria-label={`Drag ${label} to a new position`}
            className="layout-drag-handle"
            title={`Drag ${label}, or press Space and use the arrow keys`}
            type="button"
          >
            <span aria-hidden="true">⠿</span>
            <span>Drag</span>
          </button>
          <span className="layout-position">{index + 1}/{itemCount}</span>
          <div className="layout-move-buttons">
            <button
              aria-label={`Move ${label} earlier`}
              className="icon-button small"
              disabled={index === 0}
              onClick={() => onMove(card, -1)}
              title={`Move ${label} earlier`}
              type="button"
            >
              ←
            </button>
            <button
              aria-label={`Move ${label} later`}
              className="icon-button small"
              disabled={index === itemCount - 1}
              onClick={() => onMove(card, 1)}
              title={`Move ${label} later`}
              type="button"
            >
              →
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function toLayoutCardKey(value: string | number): SessionLayoutCardKey | undefined {
  return typeof value === "string" && sessionLayoutCardKeys.has(value as SessionLayoutCardKey)
    ? value as SessionLayoutCardKey
    : undefined;
}

const sessionLayoutCardKeys = new Set<SessionLayoutCardKey>([
  "transcript",
  "summary",
  "answers",
  "topics",
  "insights",
  "followups",
  "screen",
  "code",
  "systemDesign",
  "state"
]);
