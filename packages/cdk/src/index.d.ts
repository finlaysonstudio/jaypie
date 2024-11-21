declare module '@jaypie/cdk' {
    export interface CDKAccount {
        DEVELOPMENT: string;
        MANAGEMENT: string;
        OPERATIONS: string;
        PRODUCTION: string;
        SANDBOX: string;
        SECURITY: string;
        STAGE: string;
    }

    export interface CDKBuildConfig {
        ALL: string;
        API: string;
        INFRASTRUCTURE: string;
        NONE: string;
        WEB: string;
    }

    export interface CDKTAG {
        BUILD_DATE: string;
        BUILD_HEX: string;
        BUILD_NUMBER: string;
        BUILD_TIME: string;
        BUILD_TYPE: string;
        COMMIT: string;
        CREATION: string;
        ENV: string;
        NONCE: string;
        PROJECT: string;
        ROLE: string;
        SERVICE: string;
        SPONSOR: string;
        STACK: string;
        STACK_SHA: string;
        VENDOR: string;
        VERSION: string;
    }

    export interface CDK {
        ACCOUNT: CDKAccount;
        BUILD: {
            CONFIG: CDKBuildConfig;
            EPHEMERAL: string;
            STATIC: string;
        };
        CREATION: {
            CDK: string;
            CLOUDFORMATION_TEMPLATE: string;
            MANUAL: string;
        };
        DATADOG: {
            SITE: string;
            LAYER: {
                NODE: number;
                EXTENSION: number;
            };
        };
        DEFAULT: {
            REGION: string;
        };
        DURATION: {
            EXPRESS_API: number;
            LAMBDA_WORKER: number;
        };
        ENV: {
            DEMO: string;
            DEVELOPMENT: string;
            EPHEMERAL: string;
            LOCAL: string;
            MAIN: string;
            META: string;
            PREVIEW: string;
            PRODUCTION: string;
            RELEASE: string;
            REVIEW: string;
            SANDBOX: string;
            TRAINING: string;
        };
        HOST: {
            APEX: string;
        };
        IMPORT: {
            DATADOG_LOG_FORWARDER: string;
            DATADOG_ROLE: string;
            DATADOG_SECRET: string;
            LOG_BUCKET: string;
            OIDC_PROVIDER: string;
        };
        LAMBDA: {
            LOG_RETENTION: number;
            MEMORY_SIZE: number;
        };
        PROJECT: {
            INFRASTRUCTURE: string;
        };
        ROLE: {
            API: string;
            DEPLOY: string;
            HOSTING: string;
            MONITORING: string;
            NETWORKING: string;
            PROCESSING: string;
            SECURITY: string;
            STACK: string;
            STORAGE: string;
            TOY: string;
        };
        SERVICE: {
            DATADOG: string;
            INFRASTRUCTURE: string;
            LIBRARIES: string;
            NONE: string;
            TRACE: string;
        };
        TAG: CDKTAG;
        VENDOR: {
            DATADOG: string;
        };
    }

    export interface CfnOutputParams {
        CfnOutput: any;
        output: Record<string, string>;
        stack: any;
    }

    export function cfnOutput(params: CfnOutputParams): boolean;
    export function isValidHostname(hostname: string): boolean;
    export function isValidSubdomain(subdomain: string): boolean;
    export function mergeDomain(params: { subdomain: string; domain: string }): string;
    export function projectTagger(params: { project: string; stack: any }): void;

    export const CDK: CDK;

    // Re-exported from @jaypie/core
    export class BadGatewayError extends Error {}
    export class ConfigurationError extends Error {}
    export class GatewayTimeoutError extends Error {}
    export class IllogicalError extends Error {}
    export class InternalError extends Error {}
    export class MultiError extends Error {}
    export class NotImplementedError extends Error {}
    export class ProjectError extends Error {}
    export class ProjectMultiError extends Error {}
    export class UnavailableError extends Error {}
    export class UnhandledError extends Error {}
    export class UnreachableCodeError extends Error {}
}