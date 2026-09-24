// ── ROUND 1 — BOOT SEQUENCE ──────────────────────────────────────────────────
// 5 Python-debug + SQL challenges. Top 6 teams by score/time advance.
const ROUND1_PUZZLES = [
  {
    id: 1,
    title: "Boot Check #1 — The Frequency Report",
    story: "A coded transmission was intercepted near Pier 9. Our decryption script was tampered with. Fix the ASCII math and read the hidden directive.",
    buggy_code: `def decode(text, shift):
    result = ""
    for c in text:
        if c.isalpha():
            result += chr((ord(c) - 64 - shift) % 26 + 65)
        else:
            result += c
    return result

print(decode("GJOE UIF TVTQFDU XIP XPSLT UIF OJHIU TIJGU JO UIF IBSCPS EJTUSJDU", 1))`,
    expected_output: "FIND THE SUSPECT WHO WORKS THE NIGHT SHIFT IN THE HARBOR DISTRICT",
    correct_answer: "Selene Voss",
    hint: "The ASCII code for uppercase 'A' is 65, not 64."
  },
  {
    id: 2,
    title: "Boot Check #2 — The Age Equation",
    story: "An informant encoded suspect ages as perfect squares only. The filter is broken — fix the comparison so only valid ages pass through.",
    buggy_code: `def is_perfect_square(n):
    root = int(n ** 0.5)
    return root * root <= n

ages = [23, 25, 31, 36, 41, 44, 49, 53]
clue = [a for a in ages if is_perfect_square(a)]
print(f"The suspect's age is one of: {clue}")
print("Their occupation starts with the letter M")`,
    expected_output: "The suspect's age is one of: [25, 36, 49]\nTheir occupation starts with the letter M",
    correct_answer: "Marco Lind",
    hint: "A perfect square satisfies: int(sqrt(n))**2 == n. The <= lets everything through."
  },
  {
    id: 3,
    title: "Boot Check #3 — The District Map",
    story: "The district deduplication script is broken — it keeps every duplicate. Fix it and find which district is at index 3 of the unique list.",
    buggy_code: `def unique_districts(lst):
    seen = set()
    result = []
    for item in lst:
        if item not in seen:
            result.append(item)
    return result

districts = ["Harbor","Midtown","Harbor","Eastside","Midtown","Uptown","Eastside","The Pits","Uptown"]
uniq = unique_districts(districts)
print(f"Unique districts: {len(uniq)}")
print("Find the suspect last sighted in the district at index 3 of this list:")
print(uniq[3])`,
    expected_output: "Unique districts: 5\nFind the suspect last sighted in the district at index 3 of this list:\nUptown",
    correct_answer: "Iris Caldwell",
    hint: "Add seen.add(item) inside the if block after appending."
  },
  {
    id: 4,
    title: "Boot Check #4 — The Witness Statement",
    story: "A witness scrambled their message before sending it. The reversal script drops the last word due to a slicing error. Fix it to recover the full statement.",
    buggy_code: `words = ["EASTSIDE", "IN", "HOTEL", "A", "AT", "STAYING", "WAS", "SUSPECT", "THE"]
reconstructed = " ".join(words[-1:0:-1])
print(reconstructed)
print("Find the suspect staying at a hotel in the Eastside district.")`,
    expected_output: "THE SUSPECT WAS STAYING AT A HOTEL IN EASTSIDE\nFind the suspect staying at a hotel in the Eastside district.",
    correct_answer: "Dex Harmon",
    hint: "words[-1:0:-1] excludes index 0. Use words[::-1] to reverse fully."
  },
  {
    id: 5,
    title: "Boot Check #5 — The Final Cipher",
    story: "The mastermind left a ROT13-encoded name. The decoder is correct but the shift was set to zero. Restore the correct shift and expose the final name.",
    buggy_code: `def rot_decode(text, shift):
    result = ""
    for c in text:
        if c.isalpha():
            base = ord('A') if c.isupper() else ord('a')
            result += chr((ord(c) - base + shift) % 26 + base)
        else:
            result += c
    return result

encoded = "Gur fhfcrpg vf Wnar Uneyrl"
shift = 0
name = rot_decode(encoded, shift)
print(f"Decoded: {name}")
print("Find this suspect in The Pits district.")`,
    expected_output: "Decoded: The suspect is Jane Harley\nFind this suspect in The Pits district.",
    correct_answer: "Jane Harley",
    hint: "ROT13 = rotate by 13. Set shift = 13."
  }
];

// Boot Access Code revealed after all Round 1 cases are solved
const BOOT_ACCESS_CODE = "SYS-7749";

// ── ROUND 2 — SYSTEM BREACH: FINAL ESCAPE ────────────────────────────────────
// 7 chained stages: 6 Python debug challenges each revealing one letter of the
// cipher key (in scrambled order), then a final password stage.
// Scrambled collection order: E → P → C → I → H → R → rearrange → CIPHER
const ROUND2_STAGES = [
  {
    id: 1,
    type: "python",
    title: "Stage 1 — Caesar Fragment",
    story: "A signal was intercepted from a compromised relay node. The Caesar cipher decoder is broken in two places — fix both to extract the first key fragment.",
    // Ciphertext 'V' with shift 17 should decode to 'E' (E=4, V=21, 21-17=4)
    // Bug 1: ord(c) - 64 should be ord(c) - 65 (wrong base)
    // Bug 2: + shift should be - shift (wrong direction)
    // Buggy output: pos=22, (22+17)%26=13, chr(13+65)='N'
    buggy_code: `def caesar_decode(text, shift):
    result = ""
    for c in text:
        if c.isupper():
            pos     = ord(c) - 64              # adjust to alphabet position
            decoded = (pos + shift) % 26       # apply shift
            result += chr(decoded + 65)
    return result

ciphertext = "V"
shift      = 17
fragment   = caesar_decode(ciphertext, shift)
print("[SYSTEM] Signal fragment decoded.")
print(f"Fragment: {fragment}")
print("[1 of 6 fragments collected]")`,
    expected_output: "[SYSTEM] Signal fragment decoded.\nFragment: E\n[1 of 6 fragments collected]",
    result_label: "Fragment 1",
    result_value: "E",
    hint: "Two bugs: change 64 to 65 (ASCII base for uppercase), and change + shift to - shift (decode reverses the encode direction)."
  },
  {
    id: 2,
    type: "python",
    title: "Stage 2 — XOR Fragment",
    story: "A byte was extracted from the network stream, XOR-encoded against a known key. The decoder uses the wrong bitwise operator and outputs the raw numeric value instead of a character. Fix both.",
    // encoded=107, key=59: 107 ^ 59 = 80 = 'P'
    // Bug 1: & should be ^ (AND instead of XOR)
    // Bug 2: str(val) should be chr(val)
    // Buggy output: 107 & 59 = 43, str(43) = "43"
    buggy_code: `def xor_decode(data, key):
    result = ""
    for b in data:
        val     = b & key           # decode each byte
        result += str(val)          # accumulate result
    return result

encoded  = [107]
key      = 59
fragment = xor_decode(encoded, key)
print("[SYSTEM] Signal fragment decoded.")
print(f"Fragment: {fragment}")
print("[2 of 6 fragments collected]")`,
    expected_output: "[SYSTEM] Signal fragment decoded.\nFragment: P\n[2 of 6 fragments collected]",
    result_label: "Fragment 2",
    result_value: "P",
    hint: "Two bugs: change & to ^ (XOR, not AND), and change str(val) to chr(val) to convert the integer to a character."
  },
  {
    id: 3,
    type: "python",
    title: "Stage 3 — Atbash Fragment",
    story: "The third packet uses Atbash encoding — each letter maps to its mirror in the alphabet (A↔Z, B↔Y, …). The decoder computes the wrong position and returns a raw number. Fix it to recover the fragment.",
    // Atbash of 'C'(pos=2) = 'X'(pos=23), since 25-2=23. Ciphertext: 'X'.
    // Bug 1: decoded = pos  (should be 25 - pos)
    // Bug 2: str(decoded) should be chr(decoded + 65)
    // Buggy output: pos=23, str(23)="23"
    buggy_code: `def atbash_decode(text):
    result = ""
    for c in text:
        if c.isupper():
            pos     = ord(c) - 65
            decoded = pos                    # map to decoded position
            result += str(decoded)           # convert to character
    return result

ciphertext = "X"
fragment   = atbash_decode(ciphertext)
print("[SYSTEM] Signal fragment decoded.")
print(f"Fragment: {fragment}")
print("[3 of 6 fragments collected]")`,
    expected_output: "[SYSTEM] Signal fragment decoded.\nFragment: C\n[3 of 6 fragments collected]",
    result_label: "Fragment 3",
    result_value: "C",
    hint: "Two bugs: change `decoded = pos` to `decoded = 25 - pos` (mirror the position), and change str(decoded) to chr(decoded + 65)."
  },
  {
    id: 4,
    type: "python",
    title: "Stage 4 — Vigenere Fragment",
    story: "A Vigenere-encoded character was pulled from the command logs. The decryption function computes the wrong numeric shift — fix it to reveal the fourth fragment.",
    // Encode I(8) with key N(13): (8+13)%26=21, chr(21+65)='V'. Ciphertext='V', key='N'.
    // Bug 1: k_pos = ord(key_char) raw (78), should be ord(key_char) - 65 (13)
    // Bug 2: + k_pos should be - k_pos
    // Buggy output: (21+78)%26=21, chr(21+65)='V' (echoes the input)
    buggy_code: `def vigenere_decode(c, key_char):
    c_pos   = ord(c) - 65
    k_pos   = ord(key_char)          # derive key shift
    decoded = (c_pos + k_pos) % 26   # reverse Vigenere
    return chr(decoded + 65)

ciphertext = "V"
key_char   = "N"
fragment   = vigenere_decode(ciphertext, key_char)
print("[SYSTEM] Signal fragment decoded.")
print(f"Fragment: {fragment}")
print("[4 of 6 fragments collected]")`,
    expected_output: "[SYSTEM] Signal fragment decoded.\nFragment: I\n[4 of 6 fragments collected]",
    result_label: "Fragment 4",
    result_value: "I",
    hint: "Two bugs: subtract 65 from ord(key_char) to get the shift (0-25 range), and change + k_pos to - k_pos (decryption reverses encryption)."
  },
  {
    id: 5,
    type: "python",
    title: "Stage 5 — XOR Chain Fragment",
    story: "A chain of XOR operations was used to hide this fragment across multiple bytes. The accumulator uses the wrong operator, and the final result is not converted to a character. Fix both.",
    // XOR chain: 43^91^35^21^2 = 72 = 'H'
    // Bug 1: result + b (addition instead of XOR)
    // Bug 2: str(result % 26) instead of chr(result)
    // Buggy sum: 43+91+35+21+2=192, str(192%26)=str(10)="10"
    buggy_code: `def xor_chain(data):
    result = 0
    for b in data:
        result = result + b          # accumulate over data
    return str(result % 26)          # extract key value

data     = [43, 91, 35, 21, 2]
fragment = xor_chain(data)
print("[SYSTEM] Signal fragment decoded.")
print(f"Fragment: {fragment}")
print("[5 of 6 fragments collected]")`,
    expected_output: "[SYSTEM] Signal fragment decoded.\nFragment: H\n[5 of 6 fragments collected]",
    result_label: "Fragment 5",
    result_value: "H",
    hint: "Two bugs: change + to ^ (XOR accumulation, not addition), and change str(result % 26) to chr(result)."
  },
  {
    id: 6,
    type: "python",
    title: "Stage 6 — Base-36 Fragment",
    story: "The final fragment is stored as a base-36 encoded value. The decoder accumulates digits incorrectly and returns the raw number instead of a character. Fix it to recover the last fragment.",
    // R=82, base-36: 82 = 2*36 + 10 = "2A"
    // Bug 1: total = total + idx (missing * 36)
    // Bug 2: return str(total) instead of chr(total)
    // Buggy: 0+2+10=12, str(12)="12"
    buggy_code: `def base36_decode(s):
    digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    total  = 0
    for ch in s:
        total = total + digits.index(ch)    # accumulate digit value
    return str(total)                        # convert to key character

encoded  = "2A"
fragment = base36_decode(encoded)
print("[SYSTEM] Signal fragment decoded.")
print(f"Fragment: {fragment}")
print("[6 of 6 fragments collected]")`,
    expected_output: "[SYSTEM] Signal fragment decoded.\nFragment: R\n[6 of 6 fragments collected]",
    result_label: "Fragment 6",
    result_value: "R",
    hint: "Two bugs: change `total + digits.index(ch)` to `total * 36 + digits.index(ch)` (base-36 accumulation), and change str(total) to chr(total)."
  },
  {
    id: 7,
    type: "password",
    title: "Stage 7 — Reconstruct the Cipher Key",
    story: "Six fragments have been recovered from the breach. They are listed in collection order — rearrange them to spell the cipher key, then enter it to break out of the system.",
    fragments: [
      { label: "Fragment 1", value: "E" },
      { label: "Fragment 2", value: "P" },
      { label: "Fragment 3", value: "C" },
      { label: "Fragment 4", value: "I" },
      { label: "Fragment 5", value: "H" },
      { label: "Fragment 6", value: "R" }
    ],
    escape_code: "CIPHER",
    hint: "Arrange all 6 letters to form a single English word."
  }
];
