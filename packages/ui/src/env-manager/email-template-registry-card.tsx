import * as React from "react";

import { ProductChip, ProductTableAction } from "../product/product-chip";
import { TagList, type TagListColor, type TagListItem } from "../primitives/tag-list";
import { cx } from "../utils/cx";

export type EmailTemplateCategory = "transactional" | "auth" | "notification";
export type ResendTemplateStatus = "published" | "draft" | string;

export interface EmailTemplateRegistryEntry {
  id: string;
  key: string;
  name: string;
  description?: React.ReactNode;
  category: EmailTemplateCategory | string;
  variables: React.ReactNode[];
  assignments: React.ReactNode[];
}

export interface EmailTemplateResendTemplate {
  id: string;
  name: string;
  alias?: string | null;
  status: ResendTemplateStatus;
  updatedAt?: React.ReactNode;
}

export interface EmailTemplateAssignmentTarget {
  id: string;
  name: React.ReactNode;
  description?: React.ReactNode;
  selected?: boolean;
}

export interface EmailTemplateRegistryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  template: EmailTemplateRegistryEntry;
  resendTemplate?: EmailTemplateResendTemplate | null;
  assignmentTargets?: EmailTemplateAssignmentTarget[];
  onAssignmentChange?: (ids: Set<string>) => void | Promise<void>;
  onPreview?: () => void;
  onSendTest?: () => void;
  onDelete?: () => void;
}

function categoryTone(category: string) {
  return category === "auth" ? "caution" : "data";
}

function statusTone(status: string) {
  return status === "published" ? "nominal" : "caution";
}

function assignmentColor(id: string): TagListColor {
  if (id === "production" || id === "prod") return "green";
  if (id === "staging" || id === "stage") return "amber";
  if (id === "development" || id === "dev") return "improvement";
  if (id === "default") return "neutral";
  return "teal";
}

export function EmailTemplateRegistryCard({
  template,
  resendTemplate,
  assignmentTargets,
  onAssignmentChange,
  onPreview,
  onSendTest,
  onDelete,
  className,
  ...props
}: EmailTemplateRegistryCardProps) {
  const initialAssignmentIds = React.useMemo(
    () =>
      assignmentTargets
        ?.filter((target) => target.selected)
        .map((target) => target.id) ?? template.assignments.map(String),
    [assignmentTargets, template.assignments]
  );
  const [selectedAssignmentIds, setSelectedAssignmentIds] = React.useState<
    Set<string>
  >(() => new Set(initialAssignmentIds));

  React.useEffect(() => {
    setSelectedAssignmentIds(new Set(initialAssignmentIds));
  }, [initialAssignmentIds]);

  const assignmentItems = React.useMemo<TagListItem[]>(
    () =>
      assignmentTargets?.map((target) => ({
        id: target.id,
        label: target.name,
        color: assignmentColor(target.id),
      })) ??
      template.assignments.map((assignment) => {
        const id = String(assignment);
        return {
          id,
          label: assignment,
          color: assignmentColor(id),
        };
      }),
    [assignmentTargets, template.assignments]
  );
  const selectedAssignmentCount = selectedAssignmentIds.size;

  return (
    <div
      className={cx(
        "rounded-md border border-hairline-strong bg-l-surface px-s-4 py-s-3",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-s-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-s-2">
            <h3 className="font-sans text-sm font-medium text-l-ink">
              {template.name}
            </h3>
            <ProductChip tone={categoryTone(template.category)}>
              {template.category}
            </ProductChip>
            {resendTemplate ? (
              <ProductChip tone={statusTone(resendTemplate.status)}>
                {resendTemplate.status}
              </ProductChip>
            ) : (
              <ProductChip tone="critical">missing resend</ProductChip>
            )}
          </div>
          <div className="mt-[4px] font-mono text-[10px] text-event-teal">
            {template.key}
          </div>
          {template.description ? (
            <p className="mt-[4px] max-w-[64ch] text-xs text-l-ink-dim">
              {template.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-s-2">
          <ProductTableAction tone="data" onClick={onPreview}>
            Preview
          </ProductTableAction>
          <ProductTableAction tone="caution" onClick={onSendTest}>
            Send Test
          </ProductTableAction>
          <ProductTableAction tone="critical" onClick={onDelete}>
            Delete
          </ProductTableAction>
        </div>
      </div>

      <div className="mt-s-3 grid gap-s-3 border-t border-l-border-faint pt-s-3 md:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-[6px] font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
            Resend template
          </div>
          {resendTemplate ? (
            <div className="text-xs">
              <span className="font-medium text-l-ink">
                {resendTemplate.name}
              </span>
              <span className="ml-s-2 font-mono text-[10px] text-l-ink-dim">
                {resendTemplate.alias ?? resendTemplate.id}
              </span>
              {resendTemplate.updatedAt ? (
                <div className="mt-[3px] font-mono text-[10px] text-l-ink-dim">
                  updated {resendTemplate.updatedAt}
                </div>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-l-ink-dim">
              No Resend template linked
            </span>
          )}
        </div>

        <div className="grid gap-s-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <div>
            <div className="mb-[6px] font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
              Variables
            </div>
            <div className="flex flex-wrap gap-[4px]">
              {template.variables.map((variable, index) => (
                <ProductChip key={index}>{variable}</ProductChip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-[6px] flex items-center justify-between gap-s-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
                Assignments
              </span>
              <span className="font-mono text-[10px] text-l-ink-dim">
                {selectedAssignmentCount} selected
              </span>
            </div>
            <TagList
              items={assignmentItems}
              selectedIds={selectedAssignmentIds}
              dropdown={Boolean(assignmentTargets)}
              emptyLabel="No environments"
              renderLabel={({ selectedItems }) =>
                selectedItems.length === 1
                  ? "1 environment"
                  : `${selectedItems.length} environments`
              }
              placeholder="Change assignments..."
              shortcut="A"
              aria-label="Change email template assignments"
              selectionMode={onAssignmentChange ? "async" : "sync"}
              onSelectionChange={async (ids) => {
                if (onAssignmentChange) {
                  await onAssignmentChange(ids);
                }
                setSelectedAssignmentIds(new Set(ids));
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
