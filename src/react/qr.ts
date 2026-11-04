// A small QR encoder for the deposit address (drawn in-house,
// byte mode, error correction level M, as SVG on the web). Versions 1 to 10
// hold up to 213 bytes at level M, far more than an address needs. It follows
// ISO/IEC 18004: Reed-Solomon over GF(256), the eight masks scored by the four
// penalty rules, and the lowest-penalty mask kept.

const ECC_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const MAX_VERSION = 10

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

function dataCodewords(version: number): number {
  return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK_M[version]! * BLOCKS_M[version]!
}

// ---- Reed-Solomon over GF(256), polynomial 0x11D ----

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j]!, root)
      if (j + 1 < result.length) result[j] = result[j]! ^ result[j + 1]!
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ result.shift()!
    result.push(0)
    divisor.forEach((coef, i) => (result[i] = result[i]! ^ gfMultiply(coef, factor)))
  }
  return result
}

// ---- Codewords ----

function encodeData(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4) // byte mode
  push(bytes.length, version <= 9 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const capacity = dataCodewords(version) * 8
  push(0, Math.min(4, capacity - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8)
  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0))
  return out
}

function addEccAndInterleave(data: number[], version: number): number[] {
  const numBlocks = BLOCKS_M[version]!
  const eccLen = ECC_PER_BLOCK_M[version]!
  const raw = Math.floor(rawDataModules(version) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const result: number[] = []
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]!)
    })
  }
  return result
}

// ---- Matrix ----

class Matrix {
  readonly size: number
  readonly modules: boolean[][]
  readonly isFunction: boolean[][]

  constructor(readonly version: number) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
  }

  set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark
    this.isFunction[y]![x] = true
  }

  drawFunctionPatterns() {
    for (let i = 0; i < this.size; i++) {
      this.set(6, i, i % 2 === 0)
      this.set(i, 6, i % 2 === 0)
    }
    this.drawFinder(3, 3)
    this.drawFinder(this.size - 4, 3)
    this.drawFinder(3, this.size - 4)
    const positions = this.alignmentPositions()
    const n = positions.length
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) this.drawAlignment(positions[i]!, positions[j]!)
      }
    }
    this.drawFormatBits(0)
    this.drawVersion()
  }

  alignmentPositions(): number[] {
    if (this.version === 1) return []
    const n = Math.floor(this.version / 7) + 2
    const step = Math.ceil((this.version * 4 + 4) / (n * 2 - 2)) * 2
    const result = [6]
    for (let pos = this.size - 7; result.length < n; pos -= step) result.splice(1, 0, pos)
    return result
  }

  drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.set(xx, yy, dist !== 2 && dist !== 4)
      }
    }
  }

  drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }

  drawFormatBits(mask: number) {
    // Level M is 0b00
    const data = mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i))
    this.set(8, 7, bit(6))
    this.set(8, 8, bit(7))
    this.set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, bit(i))
    this.set(8, this.size - 8, true)
  }

  drawVersion() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.set(a, b, dark)
      this.set(b, a, dark)
    }
  }

  drawCodewords(codewords: number[]) {
    let i = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? this.size - 1 - vert : vert
          if (!this.isFunction[y]![x] && i < codewords.length * 8) {
            this.modules[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0
            i++
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break
          case 1: invert = y % 2 === 0; break
          case 2: invert = x % 3 === 0; break
          case 3: invert = (x + y) % 3 === 0; break
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
        }
        if (!this.isFunction[y]![x] && invert) this.modules[y]![x] = !this.modules[y]![x]
      }
    }
  }

  penalty(): number {
    const size = this.size
    const at = (x: number, y: number) => this.modules[y]![x]!
    let result = 0
    const line = (get: (i: number) => boolean) => {
      // Rule 1: runs of five or more; rule 3: finder-like 1:1:3:1:1 with four light modules on a side
      let run = 1
      for (let i = 1; i <= size; i++) {
        if (i < size && get(i) === get(i - 1)) run++
        else {
          if (run >= 5) result += 3 + (run - 5)
          run = 1
        }
      }
      // The quiet zone around the code is light, so the line is read with four light modules on each side
      const seq = `0000${Array.from({ length: size }, (_, i) => (get(i) ? 1 : 0)).join("")}0000`
      result += (seq.match(/(?=(10111010000|00001011101))/g)?.length ?? 0) * 40
    }
    for (let y = 0; y < size; y++) line((x) => at(x, y))
    for (let x = 0; x < size; x++) line((y) => at(x, y))
    // Rule 2: 2x2 blocks of one colour
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = at(x, y)
        if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) result += 3
      }
    }
    // Rule 4: balance of dark modules
    let dark = 0
    for (const row of this.modules) for (const m of row) if (m) dark++
    const total = size * size
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    return result + k * 10
  }
}

/** The modules of a QR code for `text` (true is dark), or undefined when it does not fit in version 10 */
export function qrMatrix(text: string): boolean[][] | undefined {
  const bytes = new TextEncoder().encode(text)
  let version = 1
  while (version <= MAX_VERSION && dataCodewords(version) < 2 + bytes.length + (version <= 9 ? 0 : 1)) version++
  if (version > MAX_VERSION) return undefined
  const codewords = addEccAndInterleave(encodeData(bytes, version), version)
  let best: Matrix | undefined
  let bestPenalty = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const m = new Matrix(version)
    m.drawFunctionPatterns()
    m.drawCodewords(codewords)
    m.applyMask(mask)
    m.drawFormatBits(mask)
    const p = m.penalty()
    if (p < bestPenalty) {
      bestPenalty = p
      best = m
    }
  }
  return best!.modules
}

/** One SVG path for the dark modules, in module units */
export function qrPath(modules: boolean[][]): string {
  let d = ""
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`
    })
  })
  return d
}
