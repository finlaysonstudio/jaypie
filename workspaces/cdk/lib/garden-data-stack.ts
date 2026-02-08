import { Construct } from "constructs";
import { JaypieAppStack, JaypieDynamoDb } from "@jaypie/constructs";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GardenDataStackProps {}

export class GardenDataStack extends JaypieAppStack {
  public readonly table: JaypieDynamoDb;

  constructor(scope: Construct, id?: string, props: GardenDataStackProps = {}) {
    super(scope, id ?? "JaypieGardenDataStack", { key: "garden-data" });

    this.table = new JaypieDynamoDb(this, "GardenTable");
  }
}
