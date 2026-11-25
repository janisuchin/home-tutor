/**
 * A tiny software WebAuthn authenticator for tests: real ES256 keys (WebCrypto), "none"
 * attestation, CBOR built by hand. Good enough to drive the Worker's passkey routes end to end.
 */
import { createHash, webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const enc = new TextEncoder();
export const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const sha256 = (b: Uint8Array) => new Uint8Array(createHash('sha256').update(b).digest());
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

// Minimal CBOR encoder: unsigned/negative ints, byte strings, text strings, maps.
function head(major: number, n: number): Uint8Array {
  if (n < 24) return new Uint8Array([(major << 5) | n]);
  if (n < 256) return new Uint8Array([(major << 5) | 24, n]);
  return new Uint8Array([(major << 5) | 25, n >> 8, n & 255]);
}
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;
function cbor(v: Cbor): Uint8Array {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') {
    const b = enc.encode(v);
    return concat(head(3, b.length), b);
  }
  if (v instanceof Uint8Array) return concat(head(2, v.length), v);
  const parts: Uint8Array[] = [head(5, v.size)];
  for (const [k, x] of v) parts.push(cbor(k), cbor(x));
  return concat(...parts);
}

/** WebCrypto ECDSA gives r||s; WebAuthn wants an ASN.1 DER signature. */
function derSig(raw: Uint8Array): Uint8Array {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let x = b.slice(i);
    if (x[0] & 0x80) x = concat(new Uint8Array([0]), x);
    return concat(new Uint8Array([0x02, x.length]), x);
  };
  const body = concat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return concat(new Uint8Array([0x30, body.length]), body);
}

export class SoftAuthenticator {
  private keys?: CryptoKeyPair;
  credId = webcrypto.getRandomValues(new Uint8Array(16));
  userHandle?: Uint8Array;
  count = 0;
  constructor(
    public rpId: string,
    public origin: string,
  ) {}

  async create(options: { challenge: string; user: { id: string } }) {
    this.keys = (await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await subtle.exportKey('jwk', this.keys.publicKey);
    this.userHandle = Buffer.from(options.user.id, 'base64url');
    const cose = cbor(new Map<Cbor, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, 'base64url')], [-3, Buffer.from(jwk.y!, 'base64url')]]));
    const authData = concat(sha256(enc.encode(this.rpId)), new Uint8Array([0x45]), new Uint8Array([0, 0, 0, 0]), new Uint8Array(16), new Uint8Array([0, this.credId.length]), this.credId, cose);
    const clientData = enc.encode(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin: this.origin, crossOrigin: false }));
    const att = cbor(new Map<Cbor, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    return {
      id: b64u(this.credId),
      rawId: b64u(this.credId),
      type: 'public-key',
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
      response: { clientDataJSON: b64u(clientData), attestationObject: b64u(att), transports: ['internal'] },
    };
  }

  async get(options: { challenge: string }, overrides: { origin?: string } = {}) {
    this.count++;
    const authData = concat(sha256(enc.encode(this.rpId)), new Uint8Array([0x05]), new Uint8Array([0, 0, 0, this.count]));
    const clientData = enc.encode(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin: overrides.origin ?? this.origin, crossOrigin: false }));
    const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.keys!.privateKey, concat(authData, sha256(clientData))));
    return {
      id: b64u(this.credId),
      rawId: b64u(this.credId),
      type: 'public-key',
      clientExtensionResults: {},
      response: { clientDataJSON: b64u(clientData), authenticatorData: b64u(authData), signature: b64u(derSig(raw)), userHandle: b64u(this.userHandle!) },
    };
  }
}
