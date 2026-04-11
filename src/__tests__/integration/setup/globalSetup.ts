import { MongoMemoryServer } from "mongodb-memory-server";

export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  let uri = mongod.getUri();

  process.env.DATABASE_URI = uri;
  (global as Record<string, unknown>).__MONGOD__ = mongod;
}
