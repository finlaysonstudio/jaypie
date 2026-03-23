import { Construct } from "constructs";
import {
  JaypieAppStack,
  JaypieDynamoDb,
  JaypieEnvSecret,
  JaypieMigration,
  type IndexDefinition,
} from "@jaypie/constructs";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GardenDataStackProps {}

const indexes: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  {
    name: "indexCategory",
    pk: ["scope", "model", "category"],
    sk: ["sequence"],
    sparse: true,
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
  {
    name: "indexType",
    pk: ["scope", "model", "type"],
    sk: ["sequence"],
    sparse: true,
  },
  {
    name: "indexXid",
    pk: ["scope", "model", "xid"],
    sk: ["sequence"],
    sparse: true,
  },
];

export class GardenDataStack extends JaypieAppStack {
  public readonly auth0ClientSecret: JaypieEnvSecret;
  public readonly auth0Secret: JaypieEnvSecret;
  public readonly projectSalt: JaypieEnvSecret;
  public readonly table: JaypieDynamoDb;

  constructor(scope: Construct, id?: string, props: GardenDataStackProps = {}) {
    super(scope, id ?? "JaypieGardenDataStack", { key: "garden-data" });

    this.table = new JaypieDynamoDb(this, "GardenTable", {
      indexes,
      timeToLiveAttribute: "ttl",
    });

    // Shared AUTH0_CLIENT_SECRET — used by garden-nextjs (from Auth0 dashboard)
    this.auth0ClientSecret = new JaypieEnvSecret(this, "SharedAuth0ClientSecret", {
      envKey: "AUTH0_CLIENT_SECRET",
    });

    // Shared AUTH0_SECRET — used by garden-nextjs (session encryption key)
    this.auth0Secret = new JaypieEnvSecret(this, "SharedAuth0Secret", {
      envKey: "AUTH0_SECRET",
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 64,
      },
    });

    // Shared PROJECT_SALT secret — used by garden-api, garden-nextjs, and migrations
    this.projectSalt = new JaypieEnvSecret(this, "MigrationProjectSalt", {
      envKey: "PROJECT_SALT",
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 64,
      },
    });

    new JaypieMigration(this, "GardenMigration", {
      code: "../garden-migrations/dist",
      dependencies: [this.table, this.projectSalt],
      handler: "index.handler",
      secrets: [this.projectSalt],
      tables: [this.table],
    });
  }
}
