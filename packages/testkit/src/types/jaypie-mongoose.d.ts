declare module "@jaypie/mongoose" {
  export interface MongooseConnectionOptions {
    autoIndex?: boolean;
    dbName?: string;
    maxPoolSize?: number;
    retryWrites?: boolean;
    ssl?: boolean;
    [key: string]: unknown;
  }

  /**
   * Connect to MongoDB using a connection string
   */
  export function connect(
    uri: string,
    options?: MongooseConnectionOptions
  ): Promise<boolean>;

  /**
   * Connect to MongoDB using connection details from environment variables
   */
  export function connectFromSecretEnv(
    options?: MongooseConnectionOptions
  ): Promise<boolean>;

  /**
   * Disconnect from MongoDB
   */
  export function disconnect(): Promise<boolean>;
} 