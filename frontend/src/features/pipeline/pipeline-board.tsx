"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarIcon, GripVerticalIcon, MoreHorizontalIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OpportunityStage } from "@/features/opportunities/api";
import { isClosed, STAGE_LABELS } from "@/features/opportunities/labels";
import { moveLabel } from "@/features/opportunities/stage-workflow";
import { formatCalendarDate, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Pipeline, PipelineCard, PipelineColumn } from "./api";

const COLUMN_ACCENTS: Record<OpportunityStage, string> = {
  PROSPECTING: "bg-sky-500",
  QUALIFICATION: "bg-cyan-500",
  PROPOSAL: "bg-violet-500",
  NEGOTIATION: "bg-amber-500",
  CLOSED_WON: "bg-emerald-500",
  CLOSED_LOST: "bg-muted-foreground/60",
};

/**
 * The Kanban board. Cards can be dragged (pointer, touch or keyboard: focus the grip, Space, arrows, Space) or moved
 * from their menu. Only the stages the server lists in `allowedStages` accept a card; everything else is explained
 * instead of attempted. `onMove` performs the real stage transition.
 */
export function PipelineBoard({
  board,
  showOwner,
  onMove,
  onRejectedMove,
  movingCardId,
}: {
  board: Pipeline;
  showOwner: boolean;
  onMove: (card: PipelineCard, toStage: OpportunityStage) => void;
  onRejectedMove: (card: PipelineCard, toStage: OpportunityStage) => void;
  movingCardId?: string;
}) {
  const [active, setActive] = useState<PipelineCard | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    setActive((event.active.data.current?.card as PipelineCard | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActive(null);
    const card = event.active.data.current?.card as PipelineCard | undefined;
    const toStage = event.over?.id as OpportunityStage | undefined;
    if (!card || !toStage || toStage === card.stage) return;
    if (card.allowedStages.includes(toStage)) onMove(card, toStage);
    else onRejectedMove(card, toStage);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActive(null)}>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="grid min-w-max auto-cols-[17.5rem] grid-flow-col gap-3" role="list" aria-label="Pipeline stages">
          {board.columns.map((column) => (
            <StageColumn
              key={column.stage}
              column={column}
              showOwner={showOwner}
              dragging={active}
              movingCardId={movingCardId}
              onMove={onMove}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <CardBody card={active} showOwner={showOwner} className="rotate-1 shadow-lg ring-2 ring-primary/40" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  column,
  showOwner,
  dragging,
  movingCardId,
  onMove,
}: {
  column: PipelineColumn;
  showOwner: boolean;
  dragging: PipelineCard | null;
  movingCardId?: string;
  onMove: (card: PipelineCard, toStage: OpportunityStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage });
  const accepts = dragging ? dragging.stage === column.stage || dragging.allowedStages.includes(column.stage) : true;
  const hidden = column.count - column.opportunities.length;
  const headingId = `pipeline-${column.stage}`;

  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-labelledby={headingId}
      data-stage={column.stage}
      className={cn(
        "flex max-h-[calc(100svh-17rem)] min-h-64 flex-col rounded-xl border bg-muted/40 transition-[opacity,box-shadow]",
        dragging && !accepts && "opacity-45",
        dragging && accepts && dragging.stage !== column.stage && "ring-2 ring-primary/25",
        isOver && accepts && dragging?.stage !== column.stage && "bg-primary/5 ring-primary/60",
      )}
    >
      <header className="border-b px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", COLUMN_ACCENTS[column.stage])} aria-hidden="true" />
          <h2 id={headingId} className="text-sm font-semibold">
            {STAGE_LABELS[column.stage]}
          </h2>
          <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-border" aria-label={`${column.count} opportunities`}>
            {column.count}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {formatCurrency(column.amount)}
          {!isClosed(column.stage) && <> · {formatCurrency(column.weightedAmount)} weighted</>}
        </p>
      </header>
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" aria-label={`${STAGE_LABELS[column.stage]} opportunities`}>
        {column.opportunities.map((card) => (
          <DraggableCard key={card.id} card={card} showOwner={showOwner} moving={card.id === movingCardId} onMove={onMove} />
        ))}
        {column.opportunities.length === 0 && (
          <li className="grid flex-1 place-items-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            {dragging && accepts && dragging.stage !== column.stage ? "Drop here" : "No opportunities"}
          </li>
        )}
        {hidden > 0 && (
          <li className="px-1 pt-1 text-center">
            <Link href={`/opportunities?stage=${column.stage}`} className="text-xs text-primary hover:underline">
              {hidden} more in this stage
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

function DraggableCard({
  card,
  showOwner,
  moving,
  onMove,
}: {
  card: PipelineCard;
  showOwner: boolean;
  moving: boolean;
  onMove: (card: PipelineCard, toStage: OpportunityStage) => void;
}) {
  const movable = card.allowedStages.length > 0;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !movable || moving,
  });
  // dnd-kit types its listeners loosely; these are the activators of the pointer, touch and keyboard sensors.
  const on = (listeners ?? {}) as Partial<Record<"onPointerDown" | "onTouchStart" | "onKeyDown", React.EventHandler<React.SyntheticEvent>>>;

  return (
    <li
      ref={setNodeRef}
      // Pointer and touch drags start anywhere on the card; keyboard drags start from the grip only, so pressing
      // Enter on the card's link still opens it.
      onPointerDown={on.onPointerDown}
      onTouchStart={on.onTouchStart}
      className={cn("list-none", isDragging && "opacity-30")}
      data-testid="pipeline-card"
      data-opportunity-id={card.id}
      aria-busy={moving || undefined}
    >
      <CardBody
        card={card}
        showOwner={showOwner}
        className={cn(movable && "cursor-grab active:cursor-grabbing", moving && "animate-pulse")}
        handle={
          movable ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              onKeyDown={on.onKeyDown}
              aria-label={`Drag ${card.name} to another stage`}
              className="-ml-1 rounded p-0.5 text-muted-foreground/60 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GripVerticalIcon className="size-3.5" />
            </button>
          ) : null
        }
        menu={
          movable ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Move ${card.name}`}
                className="-mr-1 rounded p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                disabled={moving}
              >
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {card.allowedStages.map((stage) => (
                    <DropdownMenuItem key={stage} onClick={() => onMove(card, stage)}>
                      {moveLabel(card.stage, stage)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
    </li>
  );
}

function CardBody({
  card,
  showOwner,
  className,
  handle,
  menu,
}: {
  card: PipelineCard;
  showOwner: boolean;
  className?: string;
  handle?: React.ReactNode;
  menu?: React.ReactNode;
}) {
  const overdue = !isClosed(card.stage) && card.closeDate < new Date().toISOString().slice(0, 10);
  return (
    <article className={cn("rounded-lg border bg-card p-3 text-sm shadow-xs", className)} aria-label={card.name}>
      <div className="flex items-start gap-1.5">
        {handle}
        <Link
          href={`/opportunities/${card.id}`}
          className="min-w-0 flex-1 leading-snug font-medium break-words hover:text-primary hover:underline"
          draggable={false}
        >
          {card.name}
        </Link>
        {menu}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.account.name}</p>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="font-semibold tabular-nums">{formatCurrency(card.amount)}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{card.probability}%</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap", overdue && "font-medium text-destructive")} title={overdue ? "Expected close date has passed" : undefined}>
          <CalendarIcon className="size-3" aria-hidden="true" />
          {formatCalendarDate(card.closeDate)}
        </span>
        {showOwner && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <UserRoundIcon className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{card.owner?.fullName ?? "Unassigned"}</span>
          </span>
        )}
      </div>
    </article>
  );
}
