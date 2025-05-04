import { Construct } from "constructs";

/**
 * Account categories for SSO group assignments
 */
export interface JaypieSsoAccountMap {
  development: string[];
  management: string[];
  operations: string[];
  production: string[];
  sandbox: string[];
  security: string[];
  stage: string[];
}

/**
 * Mapping of group types to Google Workspace group GUIDs
 */
export interface JaypieSsoGroupMap {
  administrators: string;
  analysts: string;
  developers: string;
}

/**
 * Properties for the JaypieSsoGroups construct
 */
export interface JaypieSsoGroupsProps {
  /**
   * ARN of the IAM Identity Center instance
   */
  instanceArn: string;
  
  /**
   * Mapping of account categories to AWS account IDs
   */
  accountMap: JaypieSsoAccountMap;
  
  /**
   * Mapping of group types to Google Workspace group GUIDs
   */
  groupMap: JaypieSsoGroupMap;
}

/**
 * Construct to simplify AWS SSO group management.
 * This construct encapsulates the complexity of creating permission sets
 * and assigning them to groups across multiple AWS accounts.
 */
export class JaypieSsoGroups extends Construct {
  constructor(scope: Construct, id: string, props: JaypieSsoGroupsProps) {
    super(scope, id);
    
    // Implementation of permission set creation and group assignments
    // will be added in subsequent tasks
  }
}