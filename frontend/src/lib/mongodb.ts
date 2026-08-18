import { MongoClient, Db } from "mongodb";

const MONGODB_URI = import.meta.env.VITE_MONGODB_URI || "mongodb://localhost:27017/verifact";
const DB_NAME = "verifact";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToMongoDB(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  console.log(`Connected to MongoDB Compass at ${MONGODB_URI}`);
  return { client, db };
}
