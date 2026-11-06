/**
 * Solves the small puzzle the NimbusPal service asks for before opening a chat.
 * Plain SHA-256 so it needs no outside script, and it pauses often so the page stays responsive.
 */
const K = new Uint32Array(64);
const FIRST_HASH = new Uint32Array(8);
{
  let count = 0;
  for (let candidate = 2; count < 64; candidate += 1) {
    let prime = true;
    for (let divisor = 2; divisor * divisor <= candidate; divisor += 1) {
      if (candidate % divisor === 0) {
        prime = false;
        break;
      }
    }
    if (!prime) continue;
    if (count < 8) FIRST_HASH[count] = ((Math.sqrt(candidate) % 1) * 2 ** 32) >>> 0;
    K[count] = ((Math.cbrt(candidate) % 1) * 2 ** 32) >>> 0;
    count += 1;
  }
}

const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
const words = new Uint32Array(64);

/** Counts the leading zero bits of the SHA-256 of an ASCII string. */
export function hashZeroBits(text: string): number {
  const blocks = ((text.length + 8) >> 6) + 1;
  const hash = FIRST_HASH.slice();

  for (let block = 0; block < blocks; block += 1) {
    for (let index = 0; index < 16; index += 1) {
      let word = 0;
      for (let byte = 0; byte < 4; byte += 1) {
        const position = block * 64 + index * 4 + byte;
        const value = position < text.length ? text.charCodeAt(position) : position === text.length ? 0x80 : 0;
        word = (word << 8) | value;
      }
      words[index] = word >>> 0;
    }
    if (block === blocks - 1) {
      words[14] = Math.floor((text.length * 8) / 2 ** 32);
      words[15] = (text.length * 8) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15] as number;
      const b = words[index - 2] as number;
      const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3);
      const s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
      words[index] = ((words[index - 16] as number) + s0 + (words[index - 7] as number) + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash as unknown as [number, number, number, number, number, number, number, number];
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choice + (K[index] as number) + (words[index] as number)) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    hash[0] = ((hash[0] as number) + a) >>> 0;
    hash[1] = ((hash[1] as number) + b) >>> 0;
    hash[2] = ((hash[2] as number) + c) >>> 0;
    hash[3] = ((hash[3] as number) + d) >>> 0;
    hash[4] = ((hash[4] as number) + e) >>> 0;
    hash[5] = ((hash[5] as number) + f) >>> 0;
    hash[6] = ((hash[6] as number) + g) >>> 0;
    hash[7] = ((hash[7] as number) + h) >>> 0;
  }

  let bits = 0;
  for (const word of hash) {
    if (word === 0) {
      bits += 32;
      continue;
    }
    return bits + Math.clz32(word);
  }
  return bits;
}

const BATCH = 4000;

export async function solveProof(challenge: string, difficulty: number): Promise<string> {
  for (let nonce = 0; ; nonce += 1) {
    if (hashZeroBits(`${challenge}:${nonce}`) >= difficulty) return String(nonce);
    if (nonce % BATCH === BATCH - 1) await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
