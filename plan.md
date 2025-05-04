# Project Plan from Brief: SSO Group Constructs

## Overview

This project introduces a new construct `JaypieSsoGroups` in the `@jaypie/constructs` package to simplify AWS SSO group management. This construct encapsulates the complexity of creating permission sets and assigning them to groups across multiple AWS accounts.

The construct will accept configuration for:
- AWS IAM Identity Center instance ARN
- Mapping of account categories to AWS account IDs
- Mapping of group types to Google Workspace group GUIDs

## Background

Currently, SSO group management requires extensive code to:
1. Create permission sets with appropriate policies
2. Track permission set ARNs
3. Associate groups with accounts and permission sets

The new construct will encapsulate this logic, providing a cleaner API while maintaining the same functionality.

## Tasks

Tasks should be labeled _Queued_, _Dequeued_, and _Verified_
Consider unlabeled tasks _Queued_
Once development begins, mark a task _Dequeued_
Do not move tasks to _Verified_ during the development process
A separate verification process will tag tasks _Verified_
The "first" or "next" task refers to the top-most _Queued_ task
The "last" or "previous" task refers to the bottom-most _Dequeued_ task
Only work on one task at a time
Only work on the next task unless instructed to work on the last task

1. _Verified_ Create directory structure if needed
   - Check if `packages/constructs` exists
   - Create directories as needed for the new construct
   - Ensure proper TypeScript configuration

2. _Verified_ Create JaypieSsoGroups interface
   - Create a new file at `packages/constructs/src/JaypieSsoGroups.ts`
   - Define the interface for `JaypieSsoGroupsProps` with required properties:
     - `instanceArn: string` - ARN of the IAM Identity Center instance
     - `accountMap: Record<string, string[]>` - Mapping of account categories to AWS account IDs
     - `groupMap: Record<string, string>` - Mapping of group types to Google Workspace group GUIDs

3. _Queued_ Implement permission set creation
   - Add functionality to create the three permission sets:
     - Administrator - with AdministratorAccess policy and billing access
     - Analyst - with ReadOnlyAccess policy and limited write access
     - Developer - with SystemAdministrator policy and expanded write access
   - Ensure proper tags, session durations, and descriptions match original implementation

4. _Queued_ Implement group-account-permission assignments
   - Create the logic to assign permission sets to groups across accounts
   - Implement the same assignment logic from the sample code
   - Ensure proper resource naming and tagging

5. _Queued_ Write unit tests for the construct
   - Create test file at `packages/constructs/__tests__/JaypieSsoGroups.spec.ts`
   - Test construct initialization
   - Test permission set creation
   - Test assignment creation
   - Test with various input configurations

6. _Queued_ Add exports to package index
   - Ensure the new construct is properly exported from the package

7. _Queued_ Write documentation
   - Document the new construct in README or appropriate documentation
   - Include usage examples
   - Document the properties and their expected values

## Code Examples

### Constructor Interface

```typescript
export interface JaypieSsoGroupsProps {
  /**
   * ARN of the IAM Identity Center instance
   */
  instanceArn: string;
  
  /**
   * Mapping of account categories to AWS account IDs
   */
  accountMap: {
    development: string[];
    management: string[];
    operations: string[];
    production: string[];
    sandbox: string[];
    security: string[];
    stage: string[];
  };
  
  /**
   * Mapping of group types to Google Workspace group GUIDs
   */
  groupMap: {
    administrators: string;
    analysts: string;
    developers: string;
  };
}
```

### Expected Usage

```typescript
import { JaypieSsoGroups } from "@jaypie/constructs";

const ssoGroups = new JaypieSsoGroups(this, id, {
  instanceArn,
  accountMap: {
    development: ["123456789012"],
    management: ["234567890123"],
    operations: ["345678901234"],
    production: ["456789012345"],
    sandbox: ["567890123456"],
    security: ["678901234567"],
    stage: ["789012345678"],
  },
  groupMap: {
    administrators: "c4f87458-e021-7053-669c-4dc2a2ceaadf",
    analysts: "949844c8-60b1-7046-0328-9ad0806336f1",
    developers: "5488a468-5031-7001-64d6-9ba1f377ee6d",
  }
});
```

## Implementation Notes

1. The construct should follow AWS CDK construct patterns
2. Permission sets should have the same properties as in the sample code
3. DO NOT add customization options for group properties as specified in "Out of Scope"
4. DO NOT add ability to extend or override default groups
5. DO NOT add ability to extend or override group policies
6. DO NOT add ability to extend or override account map
7. Properly handle tags and other AWS metadata
8. Follow TypeScript best practices with proper typing