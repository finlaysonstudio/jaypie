import { describe, expect, it } from "vitest";

// Subject
import sqsTestRecords from "../sqsTestRecords.function.js";

//
//
// Run tests
//

describe("SQS Test Records Function", () => {
  it("Works", () => {
    const response = sqsTestRecords();
    expect(response).not.toBeUndefined();
  });
  it("Returns an object with `Records` array attribute", () => {
    const response = sqsTestRecords();
    expect(response).toHaveProperty("Records");
    expect(response.Records).toBeArray();
  });
  it("Returns an object with `Records` array attribute with length of 0", () => {
    const response = sqsTestRecords();
    expect(response.Records).toBeArrayOfSize(0);
  });
  it("Returns objects passed in", () => {
    const records = [{ key: "one" }, { key: "two" }, { key: "three" }];
    const response = sqsTestRecords(...records);
    expect(response.Records).toBeArrayOfSize(3);
    expect(JSON.parse(response.Records[0].body)).toMatchObject(records[0]);
    expect(JSON.parse(response.Records[1].body)).toMatchObject(records[1]);
    expect(JSON.parse(response.Records[2].body)).toMatchObject(records[2]);
  });
  it("Spreads a single array of records", () => {
    const records = [{ key: "one" }, { key: "two" }, { key: "three" }];
    const response = sqsTestRecords(records);
    expect(response.Records).toBeArrayOfSize(3);
    expect(JSON.parse(response.Records[0].body)).toMatchObject(records[0]);
    expect(JSON.parse(response.Records[1].body)).toMatchObject(records[1]);
    expect(JSON.parse(response.Records[2].body)).toMatchObject(records[2]);
  });
  it("Coerces non-object, non-strings to string", () => {
    const records = [42, true, false, null, undefined];
    const response = sqsTestRecords(records);
    expect(response.Records).toBeArrayOfSize(5);
    expect(response.Records[0].body).toBeString();
    expect(response.Records[1].body).toBeString();
    expect(response.Records[2].body).toBeString();
    expect(response.Records[3].body).toBeString();
    expect(response.Records[4].body).toBeString();
    expect(response.Records[0].body).toBe("42");
    expect(response.Records[1].body).toBe("true");
    expect(response.Records[2].body).toBe("false");
    expect(response.Records[3].body).toBe("null");
    expect(response.Records[4].body).toBe("undefined");
  });
});
