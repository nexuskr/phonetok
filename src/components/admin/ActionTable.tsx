/**
 * ActionTable — generic queue table with bulk-select + row actions.
 * Reusable for Deposits / Withdrawals / AML / Refund / Anomaly admin queues.
 *
 * Design goals:
 * - 2-click action: select row → click action button.
 * - Optimistic UI: caller mutates locally; this component just emits intents.
 * - Toolbar slot for filters; empty/loading states delegated to ui primitives.
 */
import { ReactNode, useCallback, useMemo, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingList } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";

export type ActionTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
};

export type ActionTableAction<T> = {
  id: string;
  label: ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  /** Disable on a per-row basis (e.g. row already in destination state) */
  disabled?: (row: T) => boolean;
  /** Disable in bulk mode for some rows */
  bulkDisabled?: (rows: T[]) => boolean;
  /** Required confirm prompt before execute */
  confirm?: string | ((rows: T[]) => string);
  onExecute: (rows: T[]) => void | Promise<void>;
  /** If true, only available in bulk mode (toolbar). Default: both. */
  bulkOnly?: boolean;
  /** If true, only available per-row (hide from toolbar). Default: both. */
  rowOnly?: boolean;
};

export type ActionTableProps<T> = {
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey: (row: T) => string;
  columns: ActionTableColumn<T>[];
  actions?: ActionTableAction<T>[];
  toolbar?: ReactNode;
  /** Highlight a single row (e.g. deep-link target via ?id=...) */
  highlightId?: string | null;
  /** Hide the bulk-select column entirely */
  disableBulk?: boolean;
};

function ActionTableInner<T>({
  rows,
  loading,
  emptyTitle = "큐가 비어있어요",
  emptyDescription = "처리할 항목이 없습니다.",
  rowKey,
  columns,
  actions = [],
  toolbar,
  highlightId,
  disableBulk,
}: ActionTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const allKeys = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const allSelected = !disableBulk && rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === allKeys.length ? new Set() : new Set(allKeys),
    );
  }, [allKeys]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const runAction = useCallback(
    async (action: ActionTableAction<T>, rowsToRun: T[]) => {
      if (rowsToRun.length === 0) return;
      const msg =
        typeof action.confirm === "function"
          ? action.confirm(rowsToRun)
          : action.confirm;
      if (msg && !window.confirm(msg)) return;
      setBusy(action.id);
      try {
        await action.onExecute(rowsToRun);
        setSelected(new Set());
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const bulkActions = actions.filter((a) => !a.rowOnly);
  const rowActions = actions.filter((a) => !a.bulkOnly);

  return (
    <div className="space-y-3">
      {(toolbar || bulkActions.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {bulkActions.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                선택 {selected.size}/{rows.length}
              </span>
              {bulkActions.map((a) => {
                const rowsSel = rows.filter((r) => selected.has(rowKey(r)));
                const disabled =
                  rowsSel.length === 0 ||
                  busy === a.id ||
                  (a.bulkDisabled?.(rowsSel) ?? false);
                return (
                  <Button
                    key={a.id}
                    size="sm"
                    variant={a.variant ?? "default"}
                    disabled={disabled}
                    onClick={() => runAction(a, rowsSel)}
                  >
                    {a.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingList rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="rounded-xl border border-border/40 overflow-hidden glass-strong">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                {!disableBulk && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="전체 선택"
                    />
                  </TableHead>
                )}
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.header}
                  </TableHead>
                ))}
                {rowActions.length > 0 && (
                  <TableHead className="text-right w-1">액션</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const id = rowKey(r);
                const isHi = highlightId && id === highlightId;
                return (
                  <TableRow
                    key={id}
                    data-state={selected.has(id) ? "selected" : undefined}
                    className={cn(isHi && "bg-primary/10 hover:bg-primary/15")}
                  >
                    {!disableBulk && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(id)}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="선택"
                        />
                      </TableCell>
                    )}
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          c.className,
                        )}
                      >
                        {c.cell(r)}
                      </TableCell>
                    ))}
                    {rowActions.length > 0 && (
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {rowActions.map((a) => {
                            const disabled =
                              busy === a.id || (a.disabled?.(r) ?? false);
                            return (
                              <Button
                                key={a.id}
                                size="sm"
                                variant={a.variant ?? "outline"}
                                disabled={disabled}
                                onClick={() => runAction(a, [r])}
                              >
                                {a.label}
                              </Button>
                            );
                          })}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export const ActionTable = memo(ActionTableInner) as typeof ActionTableInner;
export default ActionTable;
