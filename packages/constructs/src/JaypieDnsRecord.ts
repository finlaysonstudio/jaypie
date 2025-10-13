import * as cdk from "aws-cdk-lib";
import {
  ARecord,
  CnameRecord,
  IHostedZone,
  MxRecord,
  NsRecord,
  RecordTarget,
  TxtRecord,
} from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";
import { resolveHostedZone } from "./helpers/resolveHostedZone";

export interface JaypieDnsRecordProps {
  /**
   * Optional comment to add to the DNS record
   */
  comment?: string;
  /**
   * Optional record name (subdomain). If not provided, creates record at zone apex
   */
  recordName?: string;
  /**
   * Time to live for the DNS record
   * @default CDK.DNS.CONFIG.TTL (5 minutes)
   */
  ttl?: cdk.Duration;
  /**
   * The DNS record type (A, CNAME, MX, NS, TXT)
   */
  type: string;
  /**
   * Values for the DNS record. Format depends on record type:
   * - A: Array of IPv4 addresses (e.g., ["1.2.3.4", "5.6.7.8"])
   * - CNAME: Single domain name as first element (e.g., ["example.com"])
   * - MX: Array of objects with priority and hostName (e.g., [{priority: 10, hostName: "mail.example.com"}])
   * - NS: Array of name server addresses (e.g., ["ns1.example.com", "ns2.example.com"])
   * - TXT: Array of text values (e.g., ["v=spf1 include:example.com ~all"])
   */
  values: string[] | Array<{ hostName: string; priority: number }>;
  /**
   * The hosted zone where the record will be created.
   * Can be either:
   * - A string (zone name) - will lookup the hosted zone by domain name
   * - An IHostedZone object - will use the provided zone directly
   */
  zone: string | IHostedZone;
}

export class JaypieDnsRecord extends Construct {
  public readonly record:
    | ARecord
    | CnameRecord
    | MxRecord
    | NsRecord
    | TxtRecord;

  constructor(scope: Construct, id: string, props: JaypieDnsRecordProps) {
    super(scope, id);

    const { comment, recordName, type, values } = props;
    const ttl = props.ttl || cdk.Duration.seconds(CDK.DNS.CONFIG.TTL);

    // Resolve the hosted zone (supports both string and IHostedZone)
    const zone = resolveHostedZone(scope, {
      name: `${id}HostedZone`,
      zone: props.zone,
    });

    // Common properties for all record types
    const baseProps = {
      comment,
      recordName,
      ttl,
      zone,
    };

    // Create the appropriate record based on type
    switch (type) {
      case CDK.DNS.RECORD.A: {
        if (!Array.isArray(values) || values.length === 0) {
          throw new ConfigurationError(
            "A record requires at least one IP address",
          );
        }
        this.record = new ARecord(this, "Record", {
          ...baseProps,
          target: RecordTarget.fromIpAddresses(...(values as string[])),
        });
        break;
      }

      case CDK.DNS.RECORD.CNAME: {
        if (!Array.isArray(values) || values.length === 0) {
          throw new ConfigurationError("CNAME record requires a domain name");
        }
        this.record = new CnameRecord(this, "Record", {
          ...baseProps,
          domainName: (values as string[])[0],
        });
        break;
      }

      case CDK.DNS.RECORD.MX: {
        if (!Array.isArray(values) || values.length === 0) {
          throw new ConfigurationError(
            "MX record requires at least one mail server",
          );
        }
        this.record = new MxRecord(this, "Record", {
          ...baseProps,
          values: values as Array<{ hostName: string; priority: number }>,
        });
        break;
      }

      case CDK.DNS.RECORD.NS: {
        if (!Array.isArray(values) || values.length === 0) {
          throw new ConfigurationError(
            "NS record requires at least one name server",
          );
        }
        this.record = new NsRecord(this, "Record", {
          ...baseProps,
          values: values as string[],
        });
        break;
      }

      case CDK.DNS.RECORD.TXT: {
        if (!Array.isArray(values) || values.length === 0) {
          throw new ConfigurationError(
            "TXT record requires at least one value",
          );
        }
        this.record = new TxtRecord(this, "Record", {
          ...baseProps,
          values: values as string[],
        });
        break;
      }

      default:
        throw new ConfigurationError(
          `Unsupported DNS record type: ${type}. Supported types: A, CNAME, MX, NS, TXT`,
        );
    }

    // Add standard tags to the DNS record
    cdk.Tags.of(this.record).add(CDK.TAG.SERVICE, CDK.SERVICE.INFRASTRUCTURE);
    cdk.Tags.of(this.record).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
  }
}
