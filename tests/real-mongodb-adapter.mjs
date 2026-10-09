import { MongoClient, ServerApiVersion } from "mongodb-real";

let clientPromise = null;
let activeUri = "";
globalThis.__cashnodeRealMongoClients ??= new Set();

const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
};

export function __setRealMongoConnection(input) {
  process.env.MONGODB_URI = input.uri;
  process.env.MONGODB_DB = input.dbName;

  if (input.uri !== activeUri) {
    globalThis._cashnodeMongoClientPromise = undefined;
    clientPromise = null;
    activeUri = input.uri;
  }
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI for real MongoDB test.");
  }

  return uri;
}

export async function getMongoClient() {
  if (!clientPromise) {
    clientPromise = new MongoClient(getMongoUri(), clientOptions).connect();
  }

  const client = await clientPromise;
  globalThis.__cashnodeRealMongoClients.add(client);
  return client;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "cashnode_real_tests");
}

export async function __closeRealMongoConnection() {
  for (const client of globalThis.__cashnodeRealMongoClients) {
    await client.close();
  }

  globalThis.__cashnodeRealMongoClients.clear();
  clientPromise = null;
  activeUri = "";
}
