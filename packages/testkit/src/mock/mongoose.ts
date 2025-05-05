import { createMockFunction } from "./utils";

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
    async () => ({ modifiedCount: 1 }),
  ),
  deleteOne: createMockFunction<() => Promise<{ deletedCount: number }>>(
    async () => ({ deletedCount: 1 }),
  ),
});
