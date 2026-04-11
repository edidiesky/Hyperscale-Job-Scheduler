import redisClient from "../../../__mocks__/ioredis";
import { afterAll, afterEach, beforeAll } from "@jest/globals";
import mongoose from "mongoose";
beforeAll(async () => {
  await mongoose.connect(process.env.DATABASE_URI as string);
});
afterEach(async () => {
  await (
    redisClient as unknown as { flushall: () => Promise<void> }
  ).flushall();
  const db = await mongoose.connection.db;
  if (db) {
    const collection = db.listCollections().toArray();
    await Promise.all(
      (await collection).map((col) => db.collection(col.name).deleteMany({})),
    );
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});


