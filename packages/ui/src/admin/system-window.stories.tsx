import type { Meta, StoryObj } from "@storybook/react";
import { SystemWindow, SysRow, SysPre, SysOk } from "./system-window";

const meta: Meta<typeof SystemWindow> = {
  title: "Admin/SystemWindow",
  component: SystemWindow,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof SystemWindow>;

/* ── E.1 — importer log ────────────────────────────────────── */

export const ImporterLog: Story = {
  name: "E.1 · importer log",
  render: () => (
    <div className="w-[720px]">
      <SystemWindow title="backend/bin/workos-import — cutover" note="/ live">
        <div className="flex flex-col gap-s-1">
          <span className="text-ink-dim">
            $ cargo run --bin workos-import --release
          </span>
          <span className="text-ink-dim"> Compiling chronicle_auth v0.6.0</span>
          <span className="text-ink-dim">
            {" "}
            Finished release [optimized] target(s) in 8.31s
          </span>
          <span className="text-ink-dim">
            {" "}
            Running `target/release/workos-import`
          </span>
        </div>
        <SysPre label="LOG">
          {`importer: connected to WorkOS prod (workos_client_id_01H8…)
importer: scanning 4128 user rows…
[01/04128] ada@stripe.com         → wos_01H8YV…  org_01H8…  ✓
[02/04128] ben@anthropic.com      → wos_01H8YV…  org_01H8…  ✓
[03/04128] cori@globex.com        → wos_01H8YV…  org_01H8…  ✓
[04/04128] dax@initech.com        → wos_01H8YV…  org_01H8…  ✓
…
[4128/4128] zoe@wayne.com         → wos_01H8YV…  org_01H8…  ✓

writeback:
  UPDATE "User" SET "workosUserId" = $1 WHERE id = $2;  -- ×4128
  UPDATE "Tenant" SET "workosOrganizationId" = $1 WHERE id = $2;  -- ×312

✓ 4128 / 4128 users imported · 0 errors · 0 skipped
done in 14m 22s`}
        </SysPre>
        <div className="flex items-center gap-s-3 pt-s-1">
          <SysOk>4128 OK</SysOk>
          <span className="text-ink-dim">
            ready to drop User.password column
          </span>
        </div>
      </SystemWindow>
    </div>
  ),
};

/* ── F.1 — webhook payload (directory.user.created) ────────── */

export const WebhookCreated: Story = {
  name: "F.1 · webhook payload",
  render: () => (
    <div className="w-[720px]">
      <SystemWindow title="POST /api/webhooks/workos · directory.user.created">
        <SysRow
          label="Signature"
          value={
            <>
              t=1743123456,v1=ec2d3a… <SysOk>VERIFIED</SysOk>
            </>
          }
        />
        <SysRow label="Endpoint" value="POST /api/webhooks/workos" />
        <SysRow label="Source" value="WorkOS Directory Sync · Okta" />
        <SysPre label="BODY">
          {`{
  "id": "evt_01H8YV4Q3X2C9R3KJ8K3M3VG2D",
  "event": "directory.user.created",
  "data": {
    "id": "directory_user_01H8YV…",
    "directory_id": "directory_01H8…",
    "organization_id": "org_01H8YV4Q3X2C9R3KJ8K3M3VG2D",
    "emails": [
      { "primary": true, "value": "alex@acme.com" }
    ],
    "first_name": "Alex",
    "last_name": "Vega",
    "username": "alex@acme.com",
    "groups": [
      { "name": "Engineering" }
    ],
    "raw_attributes": { … }
  }
}`}
        </SysPre>
        <div className="flex items-center gap-s-3 pt-s-1">
          <span className="text-ember">↓ JIT-create local User row</span>
        </div>
      </SystemWindow>
    </div>
  ),
};

/* ── F.2 — admin user detail ───────────────────────────────── */

export const AdminUserDetail: Story = {
  name: "F.2 · admin user detail",
  render: () => (
    <div className="w-[720px]">
      <SystemWindow title="admin · users · alex@acme.com">
        <SysRow label="Email" value="alex@acme.com" />
        <SysRow label="Tenant" value="Acme Industries (tenant_01H8…)" />
        <SysRow label="WorkOS user" value="wos_01H8YV4Q3X2C9R3KJ8K3M3VG2D" />
        <SysRow label="WorkOS org" value="org_01H8YV4Q3X2C9R3KJ8K3M3VG2D" />
        <SysRow label="Role" value="Member" />
        <SysRow
          label="CreatedVia"
          value="SCIM webhook · directory.user.created"
          tone="highlight"
        />
        <SysRow label="Created at" value="2026-04-25T18:14:32Z" />
        <SysRow
          label="First sign-in"
          value="not yet — the row's already here"
          tone="muted"
        />
      </SystemWindow>
    </div>
  ),
};

/* ── F.4 — directory.user.deleted ──────────────────────────── */

export const DeletionEvent: Story = {
  name: "F.4 · deletion event",
  render: () => (
    <div className="w-[720px]">
      <SystemWindow title="POST /api/webhooks/workos · directory.user.deleted">
        <SysRow
          label="Signature"
          value={
            <>
              t=1743124000,v1=99a8… <SysOk>VERIFIED</SysOk>
            </>
          }
        />
        <SysRow label="Subject" value="alex@acme.com (wos_01H8YV…)" />
        <SysPre label="BODY">
          {`{
  "event": "directory.user.deleted",
  "data": {
    "id": "directory_user_01H8YV…",
    "organization_id": "org_01H8YV4Q3X2C9R3KJ8K3M3VG2D"
  }
}`}
        </SysPre>
        <SysPre label="WRITEBACK">
          {`UPDATE "User"
   SET "deleted_at" = NOW(),
       "role"       = NULL
 WHERE "workosUserId" = 'wos_01H8YV4Q3X2C9R3KJ8K3M3VG2D';`}
        </SysPre>
        <div className="flex flex-col gap-[2px] pt-s-1 text-ink-dim">
          <span>→ active sessions invalidated</span>
          <span>→ JWT refresh denied at next sign-in</span>
        </div>
      </SystemWindow>
    </div>
  ),
};
