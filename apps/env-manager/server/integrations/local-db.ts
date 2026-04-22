export {
  checkDockerAvailable,
  getContainerStatus,
  startPostgres,
  stopPostgres,
  resetPostgres,
  getDbInfo,
  getMigrationStatus,
  runMigrations,
  runSeed,
  getBackendPid,
  getBackendLogs,
  restartBackend,
  getLocalDbStatus,
} from "@/lib/local-db";

export type {
  ContainerState,
  ContainerStatus,
  MigrationEntry,
  MigrationStatus,
  MigrationResult,
  DbInfo,
  LocalDbStatus,
} from "@/lib/local-db";
