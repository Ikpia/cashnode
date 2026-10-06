let queuedResults = [];
let calls = [];

export class PublicKey {
  constructor(value) {
    if (!value) {
      throw new Error("Invalid public key.");
    }

    this.value = String(value);
  }

  toBase58() {
    return this.value;
  }

  equals(other) {
    return this.toBase58() === String(other?.toBase58?.() ?? other);
  }
}

export class Connection {
  constructor(rpcUrl, commitment) {
    this.rpcUrl = rpcUrl;
    this.commitment = commitment;
  }

  async getTransaction(signature, options) {
    calls.push({ signature, options });
    const result = queuedResults.shift();

    if (result instanceof Error) {
      throw result;
    }

    return result ?? null;
  }
}

export function __queueTransactions(results) {
  queuedResults = results.slice();
}

export function __getTransactionCalls() {
  return calls.slice();
}

export function __resetSolanaMock() {
  queuedResults = [];
  calls = [];
}

export const SystemProgram = { programId: new PublicKey("11111111111111111111111111111111") };
export const SYSVAR_RENT_PUBKEY = new PublicKey("SysvarRent111111111111111111111111111111111");
export class Transaction {}
export class TransactionInstruction {}
