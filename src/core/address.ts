// EVM address checks for the optional refund address:
// 0x plus 40 hex characters, and the EIP-55 checksum when it is mixed case.
// EIP-55 needs Keccak-256, which WebCrypto does not have, so it is here in a
// few lines rather than a dependency.

const MASK = (1n << 64n) - 1n

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
]

// Rotation offset of lane x + 5y
const ROTATIONS = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14]

const rotl = (lane: bigint, n: number) => (n === 0 ? lane : ((lane << BigInt(n)) | (lane >> BigInt(64 - n))) & MASK)

function permute(a: bigint[]) {
  const c = new Array<bigint>(5)
  const b = new Array<bigint>(25)
  for (const rc of ROUND_CONSTANTS) {
    for (let x = 0; x < 5; x++) c[x] = a[x]! ^ a[x + 5]! ^ a[x + 10]! ^ a[x + 15]! ^ a[x + 20]!
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5]! ^ rotl(c[(x + 1) % 5]!, 1)
      for (let y = 0; y < 25; y += 5) a[x + y] = a[x + y]! ^ d
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(a[x + 5 * y]!, ROTATIONS[x + 5 * y]!)
    }
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) a[x + y] = b[x + y]! ^ (~b[((x + 1) % 5) + y]! & MASK & b[((x + 2) % 5) + y]!)
    }
    a[0] = a[0]! ^ rc
  }
}

/** Keccak-256 (the Ethereum hash, not SHA3-256: padding 0x01) */
export function keccak256(input: Uint8Array): Uint8Array {
  const rate = 136
  const blocks = Math.floor(input.length / rate) + 1
  const padded = new Uint8Array(blocks * rate)
  padded.set(input)
  padded[input.length] = padded[input.length]! ^ 0x01
  padded[padded.length - 1] = padded[padded.length - 1]! ^ 0x80
  const state = new Array<bigint>(25).fill(0n)
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let value = 0n
      for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(padded[offset + lane * 8 + i]!)
      state[lane] = state[lane]! ^ value
    }
    permute(state)
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = Number((state[i >> 3]! >> BigInt(8 * (i & 7))) & 0xffn)
  return out
}

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** The EIP-55 checksummed form of an address */
export function toChecksumAddress(address: string): string {
  const lower = address.slice(2).toLowerCase()
  // ASCII hex, so each character is one byte (no TextEncoder: older Hermes lacks it)
  const hash = keccak256(Uint8Array.from(lower, (c) => c.charCodeAt(0)))
  let out = "0x"
  for (let i = 0; i < 40; i++) {
    const nibble = (hash[i >> 1]! >> (i % 2 === 0 ? 4 : 0)) & 0x0f
    out += nibble >= 8 ? lower[i]!.toUpperCase() : lower[i]
  }
  return out
}

export type AddressCheck = "ok" | "format" | "checksum"

/** "format": not 0x + 40 hex; "checksum": mixed case that fails EIP-55. All-lower and all-upper skip the checksum */
export function checkEvmAddress(value: string): AddressCheck {
  const address = value.trim()
  if (!HEX_ADDRESS.test(address)) return "format"
  const body = address.slice(2)
  if (body === body.toLowerCase() || body === body.toUpperCase()) return "ok"
  return toChecksumAddress(address) === address ? "ok" : "checksum"
}
