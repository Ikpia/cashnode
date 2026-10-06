let db = createDb();

export class MongoServerError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.code = options.code;
  }
}

export class ObjectId {
  constructor(value) {
    if (value instanceof ObjectId) {
      this.value = value.value;
      return;
    }

    if (value === undefined || value === null || value === "") {
      this.value = nextObjectId();
      return;
    }

    this.value = String(value);
  }

  static isValid(value) {
    return value instanceof ObjectId || /^[a-fA-F0-9]{24}$/.test(String(value));
  }

  toHexString() {
    return this.value;
  }

  toString() {
    return this.value;
  }
}

let objectIdCounter = 0;

function nextObjectId() {
  objectIdCounter += 1;
  return objectIdCounter.toString(16).padStart(24, "0");
}

function createDb() {
  const collections = new Map();

  return {
    collection(name) {
      if (!collections.has(name)) {
        collections.set(name, createCollection(name));
      }

      return collections.get(name);
    },
    __collections: collections
  };
}

export function __resetMongo() {
  for (const collection of db.__collections.values()) {
    collection.__documents.length = 0;
  }
  objectIdCounter = 0;
}

export async function getMongoDb() {
  return db;
}

export async function getMongoClient() {
  return {
    db: () => db
  };
}

function createCollection(name) {
  const documents = [];
  const uniqueIndexes = [];
  const indexes = [];

  return {
    name,
    __documents: documents,
    __indexes: indexes,
    __lastFindFilter: null,
    async createIndexes(indexes) {
      for (const index of indexes) {
        if (!this.__indexes.some((existingIndex) => existingIndex.name === index.name)) {
          this.__indexes.push(index);
        }

        if (index.unique) {
          uniqueIndexes.push(index);
        }
      }

      enforceUniqueIndexes(documents, uniqueIndexes);
      return indexes.map((index) => index.name);
    },
    async insertOne(document) {
      const stored = cloneDocument({
        ...document,
        _id: document._id ?? new ObjectId()
      });

      enforceUniqueIndexes([...documents, stored], uniqueIndexes);
      documents.push(stored);

      return {
        insertedId: stored._id
      };
    },
    async findOne(filter = {}) {
      const found = documents.find((document) => matchesFilter(document, filter));
      return found ? cloneDocument(found) : null;
    },
    find(filter = {}) {
      this.__lastFindFilter = cloneDocument(filter);
      let result = documents.filter((document) => matchesFilter(document, filter)).map(cloneDocument);
      result = sortNearResults(result, filter);

      const cursor = {
        sort(sortSpec) {
          result = sortDocuments(result, sortSpec);
          return cursor;
        },
        limit(count) {
          result = result.slice(0, count);
          return cursor;
        },
        project() {
          return cursor;
        },
        async toArray() {
          return result.map(cloneDocument);
        },
        async next() {
          return result[0] ? cloneDocument(result[0]) : null;
        }
      };

      return cursor;
    },
    async updateOne(filter, update, options = {}) {
      const index = documents.findIndex((document) => matchesFilter(document, filter));

      if (index === -1) {
        if (!options.upsert) {
          return { matchedCount: 0, modifiedCount: 0, upsertedId: null };
        }

        const upserted = { _id: new ObjectId(), ...filter };
        applyUpdate(upserted, update, { insert: true });
        enforceUniqueIndexes([...documents, upserted], uniqueIndexes);
        documents.push(upserted);
        return { matchedCount: 0, modifiedCount: 0, upsertedId: upserted._id };
      }

      const updated = cloneDocument(documents[index]);
      applyUpdate(updated, update);
      const nextDocuments = documents.slice();
      nextDocuments[index] = updated;
      enforceUniqueIndexes(nextDocuments, uniqueIndexes);
      documents[index] = updated;

      return { matchedCount: 1, modifiedCount: 1, upsertedId: null };
    },
    async updateMany(filter, update) {
      let modifiedCount = 0;

      for (let index = 0; index < documents.length; index += 1) {
        if (matchesFilter(documents[index], filter)) {
          const updated = cloneDocument(documents[index]);
          applyUpdate(updated, update);
          documents[index] = updated;
          modifiedCount += 1;
        }
      }

      enforceUniqueIndexes(documents, uniqueIndexes);
      return { matchedCount: modifiedCount, modifiedCount };
    }
  };
}

function cloneDocument(value) {
  if (value instanceof ObjectId) {
    return new ObjectId(value);
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (Array.isArray(value)) {
    return value.map(cloneDocument);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneDocument(nested)]));
  }

  return value;
}

function sortDocuments(documents, sortSpec = {}) {
  const entries = Object.entries(sortSpec);

  return documents.slice().sort((left, right) => {
    for (const [path, direction] of entries) {
      const leftValue = getPath(left, path);
      const rightValue = getPath(right, path);
      const leftComparable = leftValue instanceof Date ? leftValue.getTime() : leftValue;
      const rightComparable = rightValue instanceof Date ? rightValue.getTime() : rightValue;

      if (leftComparable < rightComparable) return direction < 0 ? 1 : -1;
      if (leftComparable > rightComparable) return direction < 0 ? -1 : 1;
    }

    return 0;
  });
}

function applyUpdate(document, update, options = {}) {
  for (const [path, value] of Object.entries(update.$set ?? {})) {
    setPath(document, path, cloneDocument(value));
  }

  if (options.insert) {
    for (const [path, value] of Object.entries(update.$setOnInsert ?? {})) {
      setPath(document, path, cloneDocument(value));
    }
  }

  for (const path of Object.keys(update.$unset ?? {})) {
    unsetPath(document, path);
  }
}

function matchesFilter(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") {
      return expected.some((candidate) => matchesFilter(document, candidate));
    }

    const actual = getPath(document, key);

    if (expected && typeof expected === "object" && !(expected instanceof ObjectId) && !(expected instanceof Date) && !Array.isArray(expected)) {
      if ("$in" in expected) {
        return expected.$in.some((value) => valuesEqual(actual, value));
      }

      if ("$exists" in expected) {
        return expected.$exists ? actual !== undefined : actual === undefined;
      }

      if ("$gt" in expected) {
        return actual > expected.$gt;
      }

      if ("$gte" in expected) {
        return actual >= expected.$gte;
      }

      if ("$ne" in expected) {
        return !valuesEqual(actual, expected.$ne);
      }

      if ("$near" in expected) {
        return hasGeoPoint(actual);
      }
    }

    return valuesEqual(actual, expected);
  });
}

function hasGeoPoint(value) {
  return (
    value &&
    typeof value === "object" &&
    value.type === "Point" &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length === 2 &&
    value.coordinates.every((coordinate) => typeof coordinate === "number")
  );
}

function sortNearResults(documents, filter) {
  const nearEntry = Object.entries(filter).find(([, value]) => value && typeof value === "object" && "$near" in value);

  if (!nearEntry) {
    return documents;
  }

  const [path, value] = nearEntry;
  const targetCoordinates = value.$near?.$geometry?.coordinates;

  if (!Array.isArray(targetCoordinates) || targetCoordinates.length !== 2) {
    return documents;
  }

  return documents.slice().sort((left, right) => {
    const leftPoint = getPath(left, path);
    const rightPoint = getPath(right, path);
    return coordinateDistance(leftPoint.coordinates, targetCoordinates) - coordinateDistance(rightPoint.coordinates, targetCoordinates);
  });
}

function coordinateDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function valuesEqual(left, right) {
  if (left instanceof ObjectId || right instanceof ObjectId) {
    return String(left?.toHexString?.() ?? left) === String(right?.toHexString?.() ?? right);
  }

  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }

  return left === right;
}

function getPath(object, path) {
  return path.split(".").reduce((current, part) => (current == null ? undefined : current[part]), object);
}

function setPath(object, path, value) {
  const parts = path.split(".");
  let current = object;

  for (const part of parts.slice(0, -1)) {
    current[part] ??= {};
    current = current[part];
  }

  current[parts.at(-1)] = value;
}

function unsetPath(object, path) {
  const parts = path.split(".");
  let current = object;

  for (const part of parts.slice(0, -1)) {
    current = current?.[part];
  }

  if (current) {
    delete current[parts.at(-1)];
  }
}

function enforceUniqueIndexes(documents, indexes) {
  for (const index of indexes) {
    const keyPath = Object.keys(index.key)[0];
    const seen = new Map();

    for (const document of documents) {
      const value = getPath(document, keyPath);

      if (value === undefined || value === null) {
        continue;
      }

      const normalized = String(value?.toHexString?.() ?? value);

      if (seen.has(normalized)) {
        throw new MongoServerError(`Duplicate key for ${keyPath}`, { code: 11000 });
      }

      seen.set(normalized, true);
    }
  }
}
