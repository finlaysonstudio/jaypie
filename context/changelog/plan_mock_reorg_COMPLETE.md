# Plan for Reorganizing Jaypie Mock Structure

## Objective
Reorganize the Jaypie mock system to make it more modular, maintainable, and future-proof.

## Current Structure Analysis
- Single file (`packages/testkit/src/jaypie.mock.ts`) with 1180+ lines
- Imports from multiple packages: aws, core, datadog, express, llm, mongoose, textract
- Re-exports mocked versions of functions and constants

## Tasks

* Tasks are labeled _Queued_, _Dequeued_, and _Verified_
* Consider unlabeled tasks _Queued_
* Once development begins, mark a task _Dequeued_
* Do not move tasks to _Verified_ during development
* The "next" task refers to the top-most _Queued_ task
* The "last" task refers to the bottom-most _Dequeued_ task
* Work on one task at a time
* Work on the next task unless instructed to work on the last task

### Task 1: Create Directory Structure
Create the directory for the new mock system:
```bash
mkdir -p packages/testkit/src/mock
```

### Task 2: Create Mock Utilities
Create `packages/testkit/src/mock/utils.ts` with helper functions:

```typescript
import { vi } from 'vitest';

/**
 * Creates function mocks with proper typing
 */
export function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: (...args: Parameters<T>) => ReturnType<T>
): T & { mock: any } {
  return vi.fn(implementation) as T & { mock: any };
}

/**
 * Creates dynamic mocks based on original implementations
 */
export function createAutoMocks<T extends Record<string, unknown>>(
  original: T,
  mockPrefix = "_MOCK_"
): Record<string, unknown> {
  const mocks: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(original)) {
    if (typeof value === "function") {
      mocks[key] = vi.fn().mockImplementation((...args: unknown[]) => {
        try {
          return value(...args);
        } catch (error) {
          return `${mockPrefix}${key.toUpperCase()}_RESULT`;
        }
      });
    } else if (typeof value === "object" && value !== null) {
      mocks[key] = value;
    } else {
      mocks[key] = value;
    }
  }
  
  return mocks;
}

/**
 * Handles recursive mocking for nested objects
 */
export function createDeepMock<T extends object>(
  template: T,
  implementation: Partial<T> = {}
): T {
  const result = { ...template } as T;
  
  for (const [key, value] of Object.entries(implementation)) {
    if (key in result) {
      (result as any)[key] = value;
    }
  }
  
  return result;
}
```

Also create `packages/testkit/__tests__/mock/utils.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockFunction, createAutoMocks, createDeepMock } from '../../src/mock/utils';

describe('Mock Utils', () => {
  describe('createMockFunction', () => {
    it('should create a mock function with the implementation', () => {
      const mockFn = createMockFunction<(a: number, b: number) => number>((a, b) => a + b);
      expect(mockFn(2, 3)).toBe(5);
      expect(mockFn.mock.calls.length).toBe(1);
    });
    
    it('should create a mock function without implementation', () => {
      const mockFn = createMockFunction<(a: string) => number>();
      mockFn('test');
      expect(mockFn.mock.calls.length).toBe(1);
      expect(mockFn.mock.calls[0][0]).toBe('test');
    });
  });

  describe('createAutoMocks', () => {
    it('should create mocks from an object', () => {
      const original = {
        func: (a: number) => a * 2,
        value: 'test',
        obj: { prop: 'value' }
      };
      
      const mocks = createAutoMocks(original);
      
      expect(typeof mocks.func).toBe('function');
      expect(mocks.value).toBe('test');
      expect(mocks.obj).toEqual({ prop: 'value' });
    });
    
    it('should handle errors in original implementation', () => {
      const original = {
        errorFunc: () => { throw new Error('Test error'); }
      };
      
      const mocks = createAutoMocks(original);
      const result = (mocks.errorFunc as Function)();
      
      expect(result).toBe('_MOCK_ERRORFUNC_RESULT');
    });
  });

  describe('createDeepMock', () => {
    it('should create a deep mock with overridden values', () => {
      const template = {
        prop1: 'value1',
        prop2: 'value2',
        nested: {
          nestedProp: 'nestedValue'
        }
      };
      
      const result = createDeepMock(template, {
        prop1: 'override1'
      });
      
      expect(result.prop1).toBe('override1');
      expect(result.prop2).toBe('value2');
    });
    
    it('should ignore properties not in template', () => {
      const template = { prop1: 'value1' };
      const result = createDeepMock(template, { 
        prop1: 'override1',
        prop2: 'value2' as any
      });
      
      expect(result.prop1).toBe('override1');
      expect((result as any).prop2).toBeUndefined();
    });
  });
});
```

### Task 3: Create Setup File
Create `packages/testkit/src/mock/setup.ts` for test environment setup:

```typescript
import { vi } from 'vitest';

/**
 * Initialize the mock environment
 */
export function setupMockEnvironment(): void {
  // Add environment variables needed for tests
  process.env.STAGE = 'test';
  process.env.NODE_ENV = 'test';
  
  // Clear all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  // Reset mocked modules between tests
  afterEach(() => {
    vi.resetModules();
  });
}

/**
 * Restore all mocks to their original state
 */
export function teardownMockEnvironment(): void {
  vi.restoreAllMocks();
}
```

Create `packages/testkit/__tests__/mock/setup.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockEnvironment, teardownMockEnvironment } from '../../src/mock/setup';

describe('Mock Setup', () => {
  const originalEnv = { ...process.env };
  const mockBeforeEach = vi.fn();
  const mockAfterEach = vi.fn();
  
  // Save original functions
  const originalBeforeEach = global.beforeEach;
  const originalAfterEach = global.afterEach;
  
  beforeEach(() => {
    // Mock global hooks
    global.beforeEach = mockBeforeEach;
    global.afterEach = mockAfterEach;
    
    // Reset mocks
    mockBeforeEach.mockReset();
    mockAfterEach.mockReset();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    
    // Restore global hooks
    global.beforeEach = originalBeforeEach;
    global.afterEach = originalAfterEach;
  });
  
  describe('setupMockEnvironment', () => {
    it('should set environment variables', () => {
      setupMockEnvironment();
      
      expect(process.env.STAGE).toBe('test');
      expect(process.env.NODE_ENV).toBe('test');
    });
    
    it('should register beforeEach hook', () => {
      setupMockEnvironment();
      
      expect(mockBeforeEach).toHaveBeenCalledTimes(1);
      
      // Execute the registered callback
      const callback = mockBeforeEach.mock.calls[0][0];
      callback();
      
      // Verify the callback clears mocks
      expect(vi.clearAllMocks).toHaveBeenCalled();
    });
    
    it('should register afterEach hook', () => {
      setupMockEnvironment();
      
      expect(mockAfterEach).toHaveBeenCalledTimes(1);
      
      // Execute the registered callback
      const callback = mockAfterEach.mock.calls[0][0];
      callback();
      
      // Verify the callback resets modules
      expect(vi.resetModules).toHaveBeenCalled();
    });
  });
  
  describe('teardownMockEnvironment', () => {
    it('should restore all mocks', () => {
      teardownMockEnvironment();
      
      expect(vi.restoreAllMocks).toHaveBeenCalled();
    });
  });
});
```

### Task 4: Create Core Mocks
Create `packages/testkit/src/mock/core.ts`:

```typescript
import { vi } from 'vitest';
import { createMockFunction } from './utils';

// Mock core errors
export class MockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class MockNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Mock core functions
export const validate = createMockFunction<(data: any, schema: any) => boolean>(
  () => true
);

export const getConfig = createMockFunction<() => Record<string, string>>(
  () => ({ environment: 'test' })
);

export const logger = {
  debug: createMockFunction<(message: string, meta?: any) => void>(),
  info: createMockFunction<(message: string, meta?: any) => void>(),
  warn: createMockFunction<(message: string, meta?: any) => void>(),
  error: createMockFunction<(message: string, meta?: any) => void>(),
};
```

Create `packages/testkit/__tests__/mock/core.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { 
  MockValidationError, 
  MockNotFoundError, 
  validate, 
  getConfig, 
  logger 
} from '../../src/mock/core';

describe('Core Mocks', () => {
  describe('Error Classes', () => {
    it('should create MockValidationError with correct name', () => {
      const error = new MockValidationError('Invalid data');
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid data');
      expect(error instanceof Error).toBe(true);
    });

    it('should create MockNotFoundError with correct name', () => {
      const error = new MockNotFoundError('Resource not found');
      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('Resource not found');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return true by default', () => {
      const result = validate({ name: 'test' }, { type: 'object' });
      expect(result).toBe(true);
    });

    it('should track calls', () => {
      const data = { name: 'test' };
      const schema = { type: 'object' };
      
      validate(data, schema);
      
      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0][0]).toBe(data);
      expect(validate.mock.calls[0][1]).toBe(schema);
    });
  });

  describe('getConfig', () => {
    it('should return default test environment', () => {
      const config = getConfig();
      expect(config).toEqual({ environment: 'test' });
    });

    it('should track calls', () => {
      getConfig();
      expect(getConfig.mock.calls.length).toBe(1);
    });
  });

  describe('logger', () => {
    it('should have mock methods for logging', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should track debug calls', () => {
      logger.debug('Debug message', { extra: 'data' });
      
      expect(logger.debug.mock.calls.length).toBe(1);
      expect(logger.debug.mock.calls[0][0]).toBe('Debug message');
      expect(logger.debug.mock.calls[0][1]).toEqual({ extra: 'data' });
    });

    it('should track info calls', () => {
      logger.info('Info message');
      
      expect(logger.info.mock.calls.length).toBe(1);
      expect(logger.info.mock.calls[0][0]).toBe('Info message');
    });
  });
});
```

### Task 5: Create AWS Mocks
Create `packages/testkit/src/mock/aws.ts`:

```typescript
import { createMockFunction } from './utils';

export const getMessages = createMockFunction<(queueUrl: string) => Promise<any[]>>(
  async () => []
);

export const getSecret = createMockFunction<(secretName: string) => Promise<string>>(
  async () => 'mock-secret-value'
);

export const sendMessage = createMockFunction<(queueUrl: string, message: any) => Promise<void>>(
  async () => {}
);

export const uploadToS3 = createMockFunction<(bucket: string, key: string, data: any) => Promise<string>>(
  async () => 'https://mock-s3-url.com'
);

export const downloadFromS3 = createMockFunction<(bucket: string, key: string) => Promise<Buffer>>(
  async () => Buffer.from('mock-data')
);
```

Create `packages/testkit/__tests__/mock/aws.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getMessages, 
  getSecret, 
  sendMessage,
  uploadToS3,
  downloadFromS3
} from '../../src/mock/aws';

describe('AWS Mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMessages', () => {
    it('should return empty array by default', async () => {
      const result = await getMessages('https://sqs.example.com/queue');
      expect(result).toEqual([]);
    });

    it('should track calls with queue URL', async () => {
      const queueUrl = 'https://sqs.example.com/queue';
      await getMessages(queueUrl);
      
      expect(getMessages.mock.calls.length).toBe(1);
      expect(getMessages.mock.calls[0][0]).toBe(queueUrl);
    });

    it('should allow customizing return value', async () => {
      const customMessages = [{ id: '1', body: 'test' }];
      getMessages.mockResolvedValueOnce(customMessages);
      
      const result = await getMessages('queue-url');
      expect(result).toEqual(customMessages);
    });
  });

  describe('getSecret', () => {
    it('should return mock secret value by default', async () => {
      const result = await getSecret('test-secret');
      expect(result).toBe('mock-secret-value');
    });

    it('should track calls with secret name', async () => {
      const secretName = 'api-key';
      await getSecret(secretName);
      
      expect(getSecret.mock.calls.length).toBe(1);
      expect(getSecret.mock.calls[0][0]).toBe(secretName);
    });
  });

  describe('sendMessage', () => {
    it('should resolve successfully', async () => {
      await expect(sendMessage('queue-url', { data: 'test' }))
        .resolves.toBeUndefined();
    });

    it('should track calls with queue URL and message', async () => {
      const queueUrl = 'queue-url';
      const message = { data: 'test' };
      
      await sendMessage(queueUrl, message);
      
      expect(sendMessage.mock.calls.length).toBe(1);
      expect(sendMessage.mock.calls[0][0]).toBe(queueUrl);
      expect(sendMessage.mock.calls[0][1]).toBe(message);
    });
  });

  describe('uploadToS3', () => {
    it('should return mock S3 URL by default', async () => {
      const result = await uploadToS3('bucket', 'key', 'data');
      expect(result).toBe('https://mock-s3-url.com');
    });

    it('should track calls with bucket, key and data', async () => {
      const bucket = 'test-bucket';
      const key = 'path/to/file.json';
      const data = { test: true };
      
      await uploadToS3(bucket, key, data);
      
      expect(uploadToS3.mock.calls.length).toBe(1);
      expect(uploadToS3.mock.calls[0][0]).toBe(bucket);
      expect(uploadToS3.mock.calls[0][1]).toBe(key);
      expect(uploadToS3.mock.calls[0][2]).toBe(data);
    });
  });

  describe('downloadFromS3', () => {
    it('should return mock data as buffer by default', async () => {
      const result = await downloadFromS3('bucket', 'key');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('mock-data');
    });

    it('should track calls with bucket and key', async () => {
      const bucket = 'test-bucket';
      const key = 'path/to/file.json';
      
      await downloadFromS3(bucket, key);
      
      expect(downloadFromS3.mock.calls.length).toBe(1);
      expect(downloadFromS3.mock.calls[0][0]).toBe(bucket);
      expect(downloadFromS3.mock.calls[0][1]).toBe(key);
    });
  });
});
```

### Task 6: Create Express Mocks
Create `packages/testkit/src/mock/express.ts`:

```typescript
import { createMockFunction, createDeepMock } from './utils';

export const mockRequest = (overrides = {}) => createDeepMock(
  {
    params: {},
    query: {},
    body: {},
    headers: {},
    cookies: {},
    session: {},
    path: '/mock-path',
    method: 'GET',
  },
  overrides
);

export const mockResponse = () => {
  const res: any = {};
  res.status = createMockFunction(() => res);
  res.json = createMockFunction(() => res);
  res.send = createMockFunction(() => res);
  res.end = createMockFunction(() => res);
  res.setHeader = createMockFunction(() => res);
  res.redirect = createMockFunction(() => res);
  res.render = createMockFunction(() => res);
  return res;
};

export const mockNext = createMockFunction<() => void>();

export const mockRouter = () => ({
  get: createMockFunction(),
  post: createMockFunction(),
  put: createMockFunction(),
  delete: createMockFunction(),
  patch: createMockFunction(),
  use: createMockFunction(),
});
```

Create `packages/testkit/__tests__/mock/express.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { mockRequest, mockResponse, mockNext, mockRouter } from '../../src/mock/express';

describe('Express Mocks', () => {
  describe('mockRequest', () => {
    it('should create a default request object', () => {
      const req = mockRequest();
      
      expect(req.params).toEqual({});
      expect(req.query).toEqual({});
      expect(req.body).toEqual({});
      expect(req.headers).toEqual({});
      expect(req.cookies).toEqual({});
      expect(req.session).toEqual({});
      expect(req.path).toBe('/mock-path');
      expect(req.method).toBe('GET');
    });

    it('should allow overriding properties', () => {
      const req = mockRequest({
        params: { id: '123' },
        query: { filter: 'active' },
        method: 'POST',
        body: { name: 'test' }
      });
      
      expect(req.params).toEqual({ id: '123' });
      expect(req.query).toEqual({ filter: 'active' });
      expect(req.method).toBe('POST');
      expect(req.body).toEqual({ name: 'test' });
      expect(req.path).toBe('/mock-path'); // Not overridden
    });
  });

  describe('mockResponse', () => {
    it('should create a response object with chainable methods', () => {
      const res = mockResponse();
      
      expect(typeof res.status).toBe('function');
      expect(typeof res.json).toBe('function');
      expect(typeof res.send).toBe('function');
      expect(typeof res.end).toBe('function');
      expect(typeof res.setHeader).toBe('function');
      expect(typeof res.redirect).toBe('function');
      expect(typeof res.render).toBe('function');
    });

    it('should allow method chaining', () => {
      const res = mockResponse();
      
      const result = res.status(200).json({ success: true });
      
      expect(result).toBe(res);
      expect(res.status.mock.calls[0][0]).toBe(200);
      expect(res.json.mock.calls[0][0]).toEqual({ success: true });
    });
    
    it('should track method calls', () => {
      const res = mockResponse();
      
      res.send('Hello, world!');
      res.status(404);
      
      expect(res.send.mock.calls.length).toBe(1);
      expect(res.send.mock.calls[0][0]).toBe('Hello, world!');
      expect(res.status.mock.calls.length).toBe(1);
      expect(res.status.mock.calls[0][0]).toBe(404);
    });
  });

  describe('mockNext', () => {
    it('should create a mock next function', () => {
      expect(typeof mockNext).toBe('function');
    });

    it('should track calls', () => {
      mockNext();
      expect(mockNext.mock.calls.length).toBe(1);
      
      const error = new Error('Test error');
      mockNext(error);
      expect(mockNext.mock.calls.length).toBe(2);
      expect(mockNext.mock.calls[1][0]).toBe(error);
    });
  });

  describe('mockRouter', () => {
    it('should create a router with HTTP method functions', () => {
      const router = mockRouter();
      
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.put).toBe('function');
      expect(typeof router.delete).toBe('function');
      expect(typeof router.patch).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should allow tracking route handlers', () => {
      const router = mockRouter();
      const handler = () => {};
      
      router.get('/users', handler);
      
      expect(router.get.mock.calls.length).toBe(1);
      expect(router.get.mock.calls[0][0]).toBe('/users');
      expect(router.get.mock.calls[0][1]).toBe(handler);
    });
  });
});
```

### Task 7: Create LLM Mocks
Create `packages/testkit/src/mock/llm.ts`:

```typescript
import { createMockFunction } from './utils';

export const getCompletion = createMockFunction<
  (prompt: string, options?: any) => Promise<string>
>(async () => 'This is a mock completion response');

export const getCompletionStream = createMockFunction<
  (prompt: string, options?: any) => AsyncIterable<any>
>(async function* () {
  yield { content: 'This ' };
  yield { content: 'is ' };
  yield { content: 'a ' };
  yield { content: 'mock ' };
  yield { content: 'streaming ' };
  yield { content: 'response' };
});

export const operate = createMockFunction<
  (question: string, context: any, options?: any) => Promise<any>
>(async () => ({ result: 'mock operation result' }));
```

Create `packages/testkit/__tests__/mock/llm.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCompletion, getCompletionStream, operate } from '../../src/mock/llm';

describe('LLM Mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCompletion', () => {
    it('should return default mock response', async () => {
      const response = await getCompletion('What is the capital of France?');
      expect(response).toBe('This is a mock completion response');
    });

    it('should track calls with prompt and options', async () => {
      const prompt = 'Tell me a joke';
      const options = { temperature: 0.7, maxTokens: 100 };
      
      await getCompletion(prompt, options);
      
      expect(getCompletion.mock.calls.length).toBe(1);
      expect(getCompletion.mock.calls[0][0]).toBe(prompt);
      expect(getCompletion.mock.calls[0][1]).toBe(options);
    });

    it('should allow customizing the response', async () => {
      const customResponse = 'Paris is the capital of France';
      getCompletion.mockResolvedValueOnce(customResponse);
      
      const response = await getCompletion('What is the capital of France?');
      expect(response).toBe(customResponse);
    });
  });

  describe('getCompletionStream', () => {
    it('should return an async iterable with chunks', async () => {
      const stream = await getCompletionStream('Tell me a story');
      const chunks = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      expect(chunks).toEqual([
        { content: 'This ' },
        { content: 'is ' },
        { content: 'a ' },
        { content: 'mock ' },
        { content: 'streaming ' },
        { content: 'response' }
      ]);
      
      // Combined content should be "This is a mock streaming response"
      const combinedContent = chunks.map(chunk => chunk.content).join('');
      expect(combinedContent).toBe('This is a mock streaming response');
    });

    it('should track calls with prompt and options', async () => {
      const prompt = 'Tell me a story';
      const options = { temperature: 0.7 };
      
      await getCompletionStream(prompt, options);
      
      expect(getCompletionStream.mock.calls.length).toBe(1);
      expect(getCompletionStream.mock.calls[0][0]).toBe(prompt);
      expect(getCompletionStream.mock.calls[0][1]).toBe(options);
    });

    it('should allow customizing the stream response', async () => {
      getCompletionStream.mockImplementationOnce(async function*() {
        yield { content: 'Custom ' };
        yield { content: 'response' };
      });
      
      const stream = await getCompletionStream('Tell me a story');
      const chunks = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      expect(chunks).toEqual([
        { content: 'Custom ' },
        { content: 'response' }
      ]);
    });
  });

  describe('operate', () => {
    it('should return default mock result', async () => {
      const question = 'How many users registered today?';
      const context = { data: [{ date: '2025-05-05', count: 42 }] };
      
      const result = await operate(question, context);
      
      expect(result).toEqual({ result: 'mock operation result' });
    });

    it('should track calls with question, context and options', async () => {
      const question = 'How many users registered today?';
      const context = { data: [{ date: '2025-05-05', count: 42 }] };
      const options = { format: 'json' };
      
      await operate(question, context, options);
      
      expect(operate.mock.calls.length).toBe(1);
      expect(operate.mock.calls[0][0]).toBe(question);
      expect(operate.mock.calls[0][1]).toBe(context);
      expect(operate.mock.calls[0][2]).toBe(options);
    });

    it('should allow customizing the result', async () => {
      const customResult = { count: 42, date: '2025-05-05' };
      operate.mockResolvedValueOnce(customResult);
      
      const result = await operate('How many users registered today?', {});
      
      expect(result).toEqual(customResult);
    });
  });
});
```

### Task 8: Create Additional Mock Files
Create remaining mock files for other packages:

1. `packages/testkit/src/mock/datadog.ts`:
```typescript
import { createMockFunction } from './utils';

export const recordMetric = createMockFunction<
  (name: string, value: number, tags?: string[]) => void
>();

export const startSpan = createMockFunction<
  (name: string, options?: any) => { finish: () => void }
>(() => ({ finish: createMockFunction() }));
```

Create `packages/testkit/__tests__/mock/datadog.spec.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordMetric, startSpan } from '../../src/mock/datadog';

describe('Datadog Mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordMetric', () => {
    it('should be a mock function', () => {
      expect(typeof recordMetric).toBe('function');
      expect(recordMetric.mock).toBeDefined();
    });

    it('should track calls with metric name, value and tags', () => {
      recordMetric('api.request.count', 1, ['endpoint:users', 'method:GET']);
      
      expect(recordMetric.mock.calls.length).toBe(1);
      expect(recordMetric.mock.calls[0][0]).toBe('api.request.count');
      expect(recordMetric.mock.calls[0][1]).toBe(1);
      expect(recordMetric.mock.calls[0][2]).toEqual(['endpoint:users', 'method:GET']);
    });
  });

  describe('startSpan', () => {
    it('should return an object with finish method', () => {
      const span = startSpan('db.query');
      
      expect(span).toBeDefined();
      expect(typeof span.finish).toBe('function');
    });

    it('should track calls with span name and options', () => {
      const options = { resource: 'getUserById' };
      startSpan('db.query', options);
      
      expect(startSpan.mock.calls.length).toBe(1);
      expect(startSpan.mock.calls[0][0]).toBe('db.query');
      expect(startSpan.mock.calls[0][1]).toBe(options);
    });

    it('should track finish method calls', () => {
      const span = startSpan('db.query');
      span.finish();
      
      expect(span.finish.mock.calls.length).toBe(1);
    });
  });
});
```

2. `packages/testkit/src/mock/lambda.ts`:
```typescript
import { createMockFunction } from './utils';

export const createHandler = createMockFunction<
  (handler: Function) => Function
>((handler) => handler);

export const mockLambdaContext = () => ({
  functionName: 'mock-function',
  awsRequestId: 'mock-request-id',
  logGroupName: 'mock-log-group',
  logStreamName: 'mock-log-stream',
  getRemainingTimeInMillis: createMockFunction<() => number>(() => 30000),
  done: createMockFunction(),
  fail: createMockFunction(),
  succeed: createMockFunction(),
});
```

Create `packages/testkit/__tests__/mock/lambda.spec.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandler, mockLambdaContext } from '../../src/mock/lambda';

describe('Lambda Mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createHandler', () => {
    it('should return the provided handler function', () => {
      const originalHandler = async (event: any) => ({ statusCode: 200 });
      const wrappedHandler = createHandler(originalHandler);
      
      expect(wrappedHandler).toBe(originalHandler);
    });

    it('should track calls with handler function', () => {
      const originalHandler = async (event: any) => ({ statusCode: 200 });
      createHandler(originalHandler);
      
      expect(createHandler.mock.calls.length).toBe(1);
      expect(createHandler.mock.calls[0][0]).toBe(originalHandler);
    });
  });

  describe('mockLambdaContext', () => {
    it('should create a context with expected properties', () => {
      const context = mockLambdaContext();
      
      expect(context.functionName).toBe('mock-function');
      expect(context.awsRequestId).toBe('mock-request-id');
      expect(context.logGroupName).toBe('mock-log-group');
      expect(context.logStreamName).toBe('mock-log-stream');
      expect(typeof context.getRemainingTimeInMillis).toBe('function');
      expect(typeof context.done).toBe('function');
      expect(typeof context.fail).toBe('function');
      expect(typeof context.succeed).toBe('function');
    });

    it('should have getRemainingTimeInMillis return 30000 by default', () => {
      const context = mockLambdaContext();
      expect(context.getRemainingTimeInMillis()).toBe(30000);
    });

    it('should track callback function calls', () => {
      const context = mockLambdaContext();
      const error = new Error('Test error');
      const result = { success: true };
      
      context.done(error, result);
      context.fail(error);
      context.succeed(result);
      
      expect(context.done.mock.calls.length).toBe(1);
      expect(context.done.mock.calls[0][0]).toBe(error);
      expect(context.done.mock.calls[0][1]).toBe(result);
      
      expect(context.fail.mock.calls.length).toBe(1);
      expect(context.fail.mock.calls[0][0]).toBe(error);
      
      expect(context.succeed.mock.calls.length).toBe(1);
      expect(context.succeed.mock.calls[0][0]).toBe(result);
    });
  });
});
```

3. `packages/testkit/src/mock/mongoose.ts`:
```typescript
import { createMockFunction } from './utils';

export const mockConnection = {
  connect: createMockFunction<() => Promise<void>>(async () => {}),
  disconnect: createMockFunction<() => Promise<void>>(async () => {}),
  isConnected: createMockFunction<() => boolean>(() => true),
};

export const mockModel = (modelName: string, schema: any) => ({
  modelName,
  schema,
  find: createMockFunction<() => any[]>(() => []),
  findOne: createMockFunction<() => any | null>(() => null),
  findById: createMockFunction<() => any | null>(() => null),
  create: createMockFunction<(data: any) => Promise<any>>(async (data) => data),
  updateOne: createMockFunction<() => Promise<{ modifiedCount: number }>>(
    async () => ({ modifiedCount: 1 })
  ),
  deleteOne: createMockFunction<() => Promise<{ deletedCount: number }>>(
    async () => ({ deletedCount: 1 })
  ),
});
```

Create `packages/testkit/__tests__/mock/mongoose.spec.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockConnection, mockModel } from '../../src/mock/mongoose';

describe('Mongoose Mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mockConnection', () => {
    it('should have connect, disconnect and isConnected methods', () => {
      expect(typeof mockConnection.connect).toBe('function');
      expect(typeof mockConnection.disconnect).toBe('function');
      expect(typeof mockConnection.isConnected).toBe('function');
    });

    it('should track connect calls', async () => {
      await mockConnection.connect();
      expect(mockConnection.connect.mock.calls.length).toBe(1);
    });

    it('should track disconnect calls', async () => {
      await mockConnection.disconnect();
      expect(mockConnection.disconnect.mock.calls.length).toBe(1);
    });

    it('should return true for isConnected by default', () => {
      expect(mockConnection.isConnected()).toBe(true);
    });
  });

  describe('mockModel', () => {
    it('should create a model with expected properties and methods', () => {
      const schema = { fields: { name: String, age: Number } };
      const model = mockModel('User', schema);
      
      expect(model.modelName).toBe('User');
      expect(model.schema).toBe(schema);
      expect(typeof model.find).toBe('function');
      expect(typeof model.findOne).toBe('function');
      expect(typeof model.findById).toBe('function');
      expect(typeof model.create).toBe('function');
      expect(typeof model.updateOne).toBe('function');
      expect(typeof model.deleteOne).toBe('function');
    });

    it('should have find return empty array by default', () => {
      const model = mockModel('User', {});
      expect(model.find()).toEqual([]);
    });

    it('should have findOne return null by default', () => {
      const model = mockModel('User', {});
      expect(model.findOne()).toBeNull();
    });

    it('should have create return the input data', async () => {
      const model = mockModel('User', {});
      const userData = { name: 'John', age: 30 };
      
      const result = await model.create(userData);
      
      expect(result).toBe(userData);
      expect(model.create.mock.calls.length).toBe(1);
      expect(model.create.mock.calls[0][0]).toBe(userData);
    });

    it('should have updateOne return modifiedCount 1 by default', async () => {
      const model = mockModel('User', {});
      const result = await model.updateOne();
      
      expect(result).toEqual({ modifiedCount: 1 });
    });

    it('should have deleteOne return deletedCount 1 by default', async () => {
      const model = mockModel('User', {});
      const result = await model.deleteOne();
      
      expect(result).toEqual({ deletedCount: 1 });
    });
  });
});
```

4. `packages/testkit/src/mock/textract.ts`:
```typescript
import { createMockFunction } from './utils';

export const extractText = createMockFunction<
  (documentBytes: Buffer) => Promise<string>
>(async () => 'Mock extracted text');

export const extractForms = createMockFunction<
  (documentBytes: Buffer) => Promise<Record<string, string>>
>(async () => ({ field1: 'value1', field2: 'value2' }));

export const extractTables = createMockFunction<
  (documentBytes: Buffer) => Promise<any[][]>
>(async () => [
  ['Header1', 'Header2'],
  ['Row1Col1', 'Row1Col2'],
  ['Row2Col1', 'Row2Col2'],
]);
```

Create `packages/testkit/__tests__/mock/textract.spec.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractText, extractForms, extractTables } from '../../src/mock/textract';

describe('Textract Mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDocumentBytes = Buffer.from('mock document content');

  describe('extractText', () => {
    it('should return default mock text', async () => {
      const result = await extractText(mockDocumentBytes);
      expect(result).toBe('Mock extracted text');
    });

    it('should track calls with document bytes', async () => {
      await extractText(mockDocumentBytes);
      
      expect(extractText.mock.calls.length).toBe(1);
      expect(extractText.mock.calls[0][0]).toBe(mockDocumentBytes);
    });

    it('should allow customizing the extracted text', async () => {
      const customText = 'Custom extracted document text';
      extractText.mockResolvedValueOnce(customText);
      
      const result = await extractText(mockDocumentBytes);
      expect(result).toBe(customText);
    });
  });

  describe('extractForms', () => {
    it('should return default form fields', async () => {
      const result = await extractForms(mockDocumentBytes);
      
      expect(result).toEqual({
        field1: 'value1',
        field2: 'value2'
      });
    });

    it('should track calls with document bytes', async () => {
      await extractForms(mockDocumentBytes);
      
      expect(extractForms.mock.calls.length).toBe(1);
      expect(extractForms.mock.calls[0][0]).toBe(mockDocumentBytes);
    });

    it('should allow customizing the form fields', async () => {
      const customFields = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234'
      };
      
      extractForms.mockResolvedValueOnce(customFields);
      
      const result = await extractForms(mockDocumentBytes);
      expect(result).toEqual(customFields);
    });
  });

  describe('extractTables', () => {
    it('should return default table data', async () => {
      const result = await extractTables(mockDocumentBytes);
      
      expect(result).toEqual([
        ['Header1', 'Header2'],
        ['Row1Col1', 'Row1Col2'],
        ['Row2Col1', 'Row2Col2']
      ]);
    });

    it('should track calls with document bytes', async () => {
      await extractTables(mockDocumentBytes);
      
      expect(extractTables.mock.calls.length).toBe(1);
      expect(extractTables.mock.calls[0][0]).toBe(mockDocumentBytes);
    });

    it('should allow customizing the table data', async () => {
      const customTable = [
        ['Name', 'Age', 'Location'],
        ['John', '30', 'New York'],
        ['Jane', '25', 'San Francisco']
      ];
      
      extractTables.mockResolvedValueOnce(customTable);
      
      const result = await extractTables(mockDocumentBytes);
      expect(result).toEqual(customTable);
    });
  });
});
```

### Task 9: Create Index File
Create `packages/testkit/src/mock/index.ts` to re-export all mocks:

```typescript
// Import all mocks
import * as aws from './aws';
import * as core from './core';
import * as datadog from './datadog';
import * as express from './express';
import * as lambda from './lambda';
import * as llm from './llm';
import * as mongoose from './mongoose';
import * as textract from './textract';
import * as utils from './utils';
import * as setup from './setup';

// Re-export all mocks
export * from './aws';
export * from './core';
export * from './datadog';
export * from './express';
export * from './lambda';
export * from './llm';
export * from './mongoose';
export * from './textract';
export * from './utils';
export * from './setup';

// Export default object with all mocks
export default {
  ...aws,
  ...core,
  ...datadog,
  ...express,
  ...lambda,
  ...llm,
  ...mongoose,
  ...textract,
  ...utils,
  ...setup,
};
```

Create `packages/testkit/__tests__/mock/index.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import mockDefault, * as mockExports from '../../src/mock';

describe('Mock Index', () => {
  it('should export all named exports correctly', () => {
    // Check some of the core exports
    expect(typeof mockExports.validate).toBe('function');
    expect(typeof mockExports.getConfig).toBe('function');
    expect(mockExports.logger).toBeDefined();
    
    // Check aws exports
    expect(typeof mockExports.getMessages).toBe('function');
    expect(typeof mockExports.getSecret).toBe('function');
    
    // Check express exports
    expect(typeof mockExports.mockRequest).toBe('function');
    expect(typeof mockExports.mockResponse).toBe('function');
    
    // Check llm exports
    expect(typeof mockExports.getCompletion).toBe('function');
    expect(typeof mockExports.operate).toBe('function');
    
    // Check utils exports
    expect(typeof mockExports.createMockFunction).toBe('function');
    expect(typeof mockExports.createDeepMock).toBe('function');
    
    // Check setup exports
    expect(typeof mockExports.setupMockEnvironment).toBe('function');
    expect(typeof mockExports.teardownMockEnvironment).toBe('function');
  });
  
  it('should have default export with all mocks', () => {
    // Check if default export contains the same functions as named exports
    for (const key of Object.keys(mockExports)) {
      if (key !== 'default') {
        expect(mockDefault).toHaveProperty(key);
        expect(mockDefault[key]).toBe(mockExports[key]);
      }
    }
  });
});
```

### Task 10: Update Package Configuration
Update `packages/testkit/package.json` exports:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  },
  "./mock": {
    "types": "./dist/mock/index.d.ts",
    "import": "./dist/mock/index.js"
  }
}
```

Update `packages/testkit/rollup.config.js` to handle the new mock structure:

```javascript
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const external = [
  'vitest',
  'express',
  'mongoose',
  'aws-sdk',
  'datadog-metrics',
  'aws-lambda'
];

export default [
  // Main package bundle
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' })
    ]
  },
  // Mock subpackage bundle
  {
    input: 'src/mock/index.ts',
    output: {
      dir: 'dist/mock',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' })
    ]
  },
  // Type definitions for main package
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  },
  // Type definitions for mock subpackage
  {
    input: 'src/mock/index.ts',
    output: {
      file: 'dist/mock/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];
```

Create a test to verify package.json exports work correctly in `packages/testkit/__tests__/exports.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as testkit from '../src';
import * as mockExports from '../src/mock';

describe('Package Exports', () => {
  it('should export main testkit functions', () => {
    // Check that the main package exports are available
    expect(testkit).toBeDefined();
    expect(typeof testkit.createTestContext).toBe('function');
  });
  
  it('should export mock functions via subpath', () => {
    // Check that mock subpath exports work correctly
    expect(mockExports).toBeDefined();
    
    // Check a few key mock exports are available
    expect(typeof mockExports.createMockFunction).toBe('function');
    expect(typeof mockExports.mockRequest).toBe('function');
    expect(typeof mockExports.getCompletion).toBe('function');
  });
});