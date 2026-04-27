import { MongoClient, ServerApiVersion, type Db } from "mongodb";

declare global {
  var _cashnodeMongoClientPromise: Promise<MongoClient> | undefined;
}

const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
} as const;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to your .env.local before using the database layer.");
  }

  return uri;
}

export async function getMongoClient() {
  if (!globalThis._cashnodeMongoClientPromise) {
    globalThis._cashnodeMongoClientPromise = new MongoClient(getMongoUri(), clientOptions).connect();
  }

  return globalThis._cashnodeMongoClientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "cashnode");
}
