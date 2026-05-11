declare module "nango" {
  export type NangoParams = Record<
    string,
    string | number | boolean | undefined
  >;

  export interface NangoGetRequest {
    endpoint: string;
    params?: NangoParams;
  }

  export interface NangoGetResponse<T = any> {
    data: T;
  }

  export interface NangoSyncClient {
    lastSyncDate?: Date;
    get<T = any>(request: NangoGetRequest): Promise<NangoGetResponse<T>>;
    log(message: string): Promise<void>;
    batchSave<T = any>(records: T[], model: string): Promise<void>;
    setMergingStrategy(
      strategy: { strategy: string },
      model: string
    ): Promise<void>;
    getConnection(): Promise<any>;
    getCheckpoint<T = any>(): Promise<T | null>;
    saveCheckpoint<T = any>(checkpoint: T): Promise<void>;
  }

  export interface NangoSyncConfig {
    description: string;
    version: string;
    frequency?: string;
    autoStart?: boolean;
    syncType?: string;
    endpoints?: Array<{
      method: string;
      path: string;
      group?: string;
    }>;
    checkpoint?: any;
    models?: Record<string, any>;
    exec: (nango: NangoSyncClient) => Promise<void>;
  }

  export function createSync(config: NangoSyncConfig): any;
}
