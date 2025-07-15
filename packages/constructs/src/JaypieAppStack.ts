import { Construct } from "constructs";
import { JaypieStack, JaypieStackProps } from "./JaypieStack";
import { constructStackName } from "./helpers";

export class JaypieAppStack extends JaypieStack {
  constructor(scope: Construct, id: string, props: JaypieStackProps = {}) {
    const { key = "app", ...stackProps } = props;

    // Handle stackName
    if (!stackProps.stackName) {
      stackProps.stackName = constructStackName(key);
    }

    super(scope, id, { key, ...stackProps });
  }
}
