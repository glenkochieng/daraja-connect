import mongoose from 'mongoose';

let memoryServer;

/**
 * Connect to MongoDB. With no MONGODB_URI outside production, start an in-memory
 * MongoDB so the project runs without a cloud database (data is lost on exit).
 */
export async function connectDatabase(config, { log = console } = {}) {
  let uri = config.mongodbUri;
  let inMemory = false;
  if (!uri) {
    if (config.isProduction) throw new Error('MONGODB_URI is required in production');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('daraja');
    inMemory = true;
    log.info?.('Started an in-memory MongoDB (development only; data is lost on exit).');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  return { inMemory };
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export function databaseState() {
  return STATES[mongoose.connection.readyState] ?? 'unknown';
}
