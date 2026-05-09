//! gen-contracts — emits the canonical TypeScript types and JSON Schema
//! files for every Rust shape that crosses an HTTP boundary.
//!
//! Output layout (relative to repo root):
//!
//!   packages/chronicle/src/types/<folder>/<TypeName>.ts        (ts-rs)
//!   packages/chronicle/src/json-schema/<folder>/<TypeName>.json (schemars)
//!
//! Folders mirror the originating Rust source file:
//!
//!   agents.rs          → agents/
//!   datasets.rs        → datasets/
//!   saas.rs            → saas/
//!   sandbox_graph.rs   → sandbox/
//!   api_types.rs       → endpoints/
//!   feature_access.rs  → feature-access/
//!
//! The matching frontend codegen (`yarn workspace chronicle gen:zod`)
//! reads the JSON files and emits Zod runtime validators next to the
//! .ts types in mirroring folders. CI runs `yarn gen:contracts` and
//! asserts a clean working tree — drift between Rust + frontend types
//! fails the build.
//!
//! Adding a new wire shape:
//!
//!   1. Annotate the Rust struct/enum with
//!      `#[derive(Serialize, Deserialize, TS, schemars::JsonSchema)]`
//!      `#[serde(rename_all = "camelCase")]`
//!      `#[ts(export, export_to = "types/<folder>/")]`
//!
//!   2. Register it in `register_types()` below via
//!      `export!(emit, "<folder>", T)`.
//!
//!   3. Run `yarn gen:contracts` from the repo root.

use anyhow::{Context, Result};
use schemars::JsonSchema;
use serde::Serialize;
use std::path::{Path, PathBuf};
use ts_rs::TS;

/// Repo-root-relative directory where TS + JSON Schema land. The
/// binary cd's the cargo working dir to the repo root before writing.
const PACKAGE_SRC: &str = "packages/chronicle/src";

fn main() -> Result<()> {
    let repo_root = repo_root().context("locating repo root")?;
    std::env::set_current_dir(&repo_root)
        .with_context(|| format!("chdir to repo root {}", repo_root.display()))?;

    // ts-rs reads this env var to override the bindings dir. Each
    // type's `#[ts(export_to = "types/<folder>/")]` stays relative to
    // here.
    std::env::set_var("TS_RS_EXPORT_DIR", PACKAGE_SRC);

    let json_root = Path::new(PACKAGE_SRC).join("json-schema");
    std::fs::create_dir_all(&json_root)
        .with_context(|| format!("create {}", json_root.display()))?;

    let ts_root = Path::new(PACKAGE_SRC).join("types");
    std::fs::create_dir_all(&ts_root)
        .with_context(|| format!("create {}", ts_root.display()))?;

    println!(
        "[gen-contracts] writing to {}/{{types,json-schema}}/<folder>/",
        PACKAGE_SRC
    );

    let mut count = 0usize;
    register_types(
        &mut |folder, name, ts_result, schema_value| -> Result<()> {
            ts_result.with_context(|| format!("ts-rs export of {name}"))?;
            let folder_dir = json_root.join(folder);
            std::fs::create_dir_all(&folder_dir)
                .with_context(|| format!("create {}", folder_dir.display()))?;
            let path = folder_dir.join(format!("{name}.json"));
            let serialised = serde_json::to_string_pretty(&schema_value)?;
            std::fs::write(&path, serialised)
                .with_context(|| format!("write {}", path.display()))?;
            println!("  + {folder}/{name}");
            count += 1;
            Ok(())
        },
    )?;

    println!("[gen-contracts] {count} type(s) exported");
    Ok(())
}

/// Walk every type that crosses an HTTP boundary, grouped by the
/// originating Rust source file. The folder argument seeds the
/// `json-schema/` and `schemas/` paths; ts-rs picks up the matching
/// folder from each struct's `#[ts(export_to = "types/<folder>/")]`
/// attribute.
fn register_types(
    emit: &mut dyn FnMut(
        &str,
        &str,
        Result<(), ts_rs::ExportError>,
        serde_json::Value,
    ) -> Result<()>,
) -> Result<()> {
    use chronicle_domain::*;

    /* ── agents.rs ─────────────────────────────────────────── */
    export!(emit, "agents", HashDomain);
    export!(emit, "agents", AgentFramework);
    export!(emit, "agents", AgentRunStatus);
    export!(emit, "agents", AgentRunOperation);
    export!(emit, "agents", AgentToolDefinition);
    export!(emit, "agents", AgentPolicy);
    export!(emit, "agents", AgentModelDescriptor);
    export!(emit, "agents", AgentContractPreview);
    export!(emit, "agents", AgentKnowledgeKind);
    export!(emit, "agents", AgentKnowledgeSource);
    export!(emit, "agents", AgentWorkflowNodeKind);
    export!(emit, "agents", AgentWorkflowNode);
    export!(emit, "agents", AgentWorkflowEdge);
    export!(emit, "agents", AgentWorkflowGraph);
    export!(emit, "agents", AgentProvenance);
    export!(emit, "agents", AgentArtifact);
    export!(emit, "agents", AgentRunError);
    export!(emit, "agents", AgentToolCall);
    export!(emit, "agents", AgentRunUsage);
    export!(emit, "agents", AgentRunResponse);
    export!(emit, "agents", AgentPreparedCall);
    export!(emit, "agents", AgentRun);
    export!(emit, "agents", HashIndexEntry);
    export!(emit, "agents", AgentVersionStatus);
    export!(emit, "agents", AgentVersionSummary);
    export!(emit, "agents", AgentSummary);
    export!(emit, "agents", AgentSnapshot);
    export!(emit, "agents", AgentManifestDiffRow);
    export!(emit, "agents", AgentDriftEntry);

    /* ── datasets.rs ───────────────────────────────────────── */
    export!(emit, "datasets", Dataset);
    export!(emit, "datasets", DatasetPurpose);
    export!(emit, "datasets", DatasetSplit);
    export!(emit, "datasets", StreamTimelineEvent);
    export!(emit, "datasets", TraceStatus);
    export!(emit, "datasets", TraceSummary);
    export!(emit, "datasets", DatasetCluster);
    export!(emit, "datasets", DatasetSimilarityEdge);
    export!(emit, "datasets", DatasetSnapshot);
    export!(emit, "datasets", CreateDatasetPayload);
    export!(emit, "datasets", DatasetPatch);
    export!(emit, "datasets", UpdateDatasetPayload);
    export!(emit, "datasets", DeleteDatasetPayload);
    export!(emit, "datasets", RemoveTraceFromDatasetPayload);
    export!(emit, "datasets", UpdateTracesPatch);
    export!(emit, "datasets", UpdateTracesPayload);
    export!(emit, "datasets", DatasetSavedViewScope);
    export!(emit, "datasets", DatasetSavedViewSort);
    export!(emit, "datasets", DatasetSavedViewFilter);
    export!(emit, "datasets", DatasetSavedViewState);
    export!(emit, "datasets", DatasetSavedView);
    export!(emit, "datasets", DatasetSavedViewPatch);
    export!(emit, "datasets", CreateSavedViewPayload);
    export!(emit, "datasets", UpdateSavedViewPayload);
    export!(emit, "datasets", DeleteSavedViewPayload);
    export!(emit, "datasets", DatasetEvalRunStatus);
    export!(emit, "datasets", DatasetEvalRun);

    /* ── saas.rs ──────────────────────────────────────────── */
    export!(emit, "saas", AgentEndpointConfig);
    export!(emit, "saas", AuditLog);
    export!(emit, "saas", Connection);
    export!(emit, "saas", IntegrationSync);
    export!(emit, "saas", Invitation);
    export!(emit, "saas", MembershipStatus);
    export!(emit, "saas", Run);
    export!(emit, "saas", RunStatus);
    export!(emit, "saas", Tenant);
    export!(emit, "saas", TenantMembership);
    export!(emit, "saas", User);
    export!(emit, "saas", UserRole);

    /* ── sandbox_graph.rs ─────────────────────────────────── */
    export!(emit, "sandbox", EventSourceConfig);
    export!(emit, "sandbox", FilterConfig);
    export!(emit, "sandbox", FilterRule);
    export!(emit, "sandbox", GeneratorConfig);
    export!(emit, "sandbox", GraphEditCommand);
    export!(emit, "sandbox", GraphEditPreview);
    export!(emit, "sandbox", GraphEditValidationError);
    export!(emit, "sandbox", OutputConfig);
    export!(emit, "sandbox", SandboxAiChatMessage);
    export!(emit, "sandbox", SandboxAiChatRole);
    export!(emit, "sandbox", SandboxDateRange);
    export!(emit, "sandbox", SandboxEdgeDto);
    export!(emit, "sandbox", SandboxFileFormat);
    export!(emit, "sandbox", SandboxNodeData);
    export!(emit, "sandbox", SandboxNodeDto);
    export!(emit, "sandbox", SandboxNodePosition);
    export!(emit, "sandbox", SandboxOutputType);
    export!(emit, "sandbox", SandboxValidationIssue);
    export!(emit, "sandbox", SandboxValidationResponse);

    /* ── api_types.rs (request/response wrappers) ─────────── */
    export!(emit, "endpoints", AdminTenantFeatureAccessResponse);
    export!(emit, "endpoints", AgentEndpointResponse);
    export!(emit, "endpoints", AuditLogListResponse);
    export!(emit, "endpoints", AuditLogParams);
    export!(emit, "endpoints", ConnectionListResponse);
    export!(emit, "endpoints", ConnectionResponse);
    export!(emit, "endpoints", CreateRunRequest);
    export!(emit, "endpoints", DashboardActivityResponse);
    export!(emit, "endpoints", DashboardStatsResponse);
    export!(emit, "endpoints", FeatureAccessResponse);
    export!(emit, "endpoints", FeatureFlagDefinitionsResponse);
    export!(emit, "endpoints", ListRunsParams);
    export!(emit, "endpoints", ListRunsResponse);
    export!(emit, "endpoints", RunDetailResponse);
    export!(emit, "endpoints", RunResponse);
    export!(emit, "endpoints", SandboxAiChatRequest);
    export!(emit, "endpoints", SandboxAiChatResponse);
    export!(emit, "endpoints", TenantResponse);
    export!(emit, "endpoints", UpdateAgentEndpointRequest);
    export!(emit, "endpoints", UpdateRunStatusRequest);
    export!(emit, "endpoints", UpdateStripeRequest);
    export!(emit, "endpoints", UpsertFeatureFlagOverrideRequest);

    /* ── connections.rs (dashboard projection) ───────────── */
    export!(emit, "connections", chronicle_domain::connections::Connection);
    export!(emit, "connections", ConnectionHealth);
    export!(emit, "connections", ConnectionTestStatus);
    export!(emit, "connections", ConnectorErrorKind);
    export!(emit, "connections", ConnectionBackfillStatus);
    export!(emit, "connections", ConnectionBackfillRecord);
    export!(emit, "connections", ConnectionEventTypeSub);
    export!(emit, "connections", ConnectionDelivery);

    /* ── timeline.rs (live observability surface) ──────────── */
    export!(emit, "timeline", TimelineWindow);
    export!(emit, "timeline", TimelineSubscriptionEvent);

    /* ── feature_access.rs ────────────────────────────────── */
    export!(emit, "feature-access", EntitlementKey);
    export!(emit, "feature-access", EntitlementSnapshot);
    export!(emit, "feature-access", FeatureAccessSnapshot);
    export!(emit, "feature-access", FeatureFlagDefinition);
    export!(emit, "feature-access", FeatureFlagKey);
    export!(emit, "feature-access", FeatureFlagOverride);
    export!(emit, "feature-access", FeatureFlagScope);
    export!(emit, "feature-access", FeatureFlagSnapshot);
    export!(emit, "feature-access", FeatureFlagType);
    export!(emit, "feature-access", FeatureValueSource);
    export!(emit, "feature-access", PlanId);

    Ok(())
}

/// Helper: invokes `T::export_all()` and produces a JSON Schema with
/// every referenced sub-shape inlined. We inline so the downstream
/// `json-schema-to-zod` step doesn't have to resolve `$ref` pointers
/// across files — each schema is fully self-contained.
#[macro_export]
macro_rules! export {
    ($emit:ident, $folder:literal, $ty:ty) => {{
        let name = <$ty as ::ts_rs::TS>::ident();
        let ts_result = <$ty as ::ts_rs::TS>::export_all();
        let settings = ::schemars::gen::SchemaSettings::draft07().with(|s| {
            s.inline_subschemas = true;
        });
        let generator = settings.into_generator();
        let schema = generator.into_root_schema_for::<$ty>();
        let value = ::serde_json::to_value(&schema)?;
        $emit($folder, &name, ts_result, value)?;
    }};
}

/// Locate the repo root by walking up from the current dir until we
/// find `package.json` with a `workspaces` array (i.e. the yarn
/// workspaces root). Falls back to two-levels-up when run from
/// `backend/` (the typical `cargo run -p gen-contracts` cwd).
fn repo_root() -> Result<PathBuf> {
    let mut cwd = std::env::current_dir()?;
    for _ in 0..6 {
        if cwd.join("package.json").exists() && cwd.join("packages").exists() {
            return Ok(cwd);
        }
        if !cwd.pop() {
            break;
        }
    }
    anyhow::bail!("could not locate repo root (looked for package.json + packages/)")
}

/// Trait alias that captures the bound used in `register_types`.
/// Keeps the macro signature focused.
#[allow(dead_code)]
trait ExportableShape: TS + JsonSchema + Serialize {}
impl<T: TS + JsonSchema + Serialize> ExportableShape for T {}
