import * as React from "react";

import { Mono } from "../../typography/mono";

export type EnrichmentProposalsProps = Record<string, unknown>;

export function EnrichmentProposals(_props: EnrichmentProposalsProps) {
  return (
    <div className="rounded-[2px] border border-dashed border-l-border-faint bg-l-wash-1 px-3 py-6 text-center">
      <Mono size="sm" tone="dim">
        EnrichmentProposals placeholder
      </Mono>
    </div>
  );
}
