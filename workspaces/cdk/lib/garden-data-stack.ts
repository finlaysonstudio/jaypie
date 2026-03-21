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
  public readonly table: JaypieDynamoDb;

  constructor(scope: Construct, id?: string, props: GardenDataStackProps = {}) {
    super(scope, id ?? "JaypieGardenDataStack", { key: "garden-data" });

    this.table = new JaypieDynamoDb(this, "GardenTable", {
      indexes,
      timeToLiveAttribute: "ttl",
    });

    // Migration Lambda runs on each deploy to seed/migrate DynamoDB data
    const adminSeed = new JaypieEnvSecret(this, "MigrationAdminSeed", {
      envKey: "PROJECT_ADMIN_SEED",
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 64,
      },
    });

    new JaypieMigration(this, "GardenMigration", {
      code: "../garden-migrations/dist",
      dependencies: [this.table, adminSeed],
      handler: "index.handler",
      secrets: [adminSeed],
      tables: [this.table],
    });
  }
}
