# Vocabulary expansion — review sheet

**38 draft entries** closing the 9 empty (category × level) combinations —
37 are needed to satisfy the rule (every combination reaching ≥ 4); the 38th is
the L2 item that went one over the floor in Greetings/Common, which is harmless.
**Draft — not native-checked.** Source: `vocabulary-expansion-draft.js`.

**How to read this.** *who speaks* is the direction the app cares about:
`helper` = she must be able to say it; `elderly` = she must understand it when
it is said to her; `either` = both. The 中文 and Bahasa columns are the glosses
that must ship with each entry — see `vocabulary-expansion-glosses.js`.

**To promote** (ids 143–180 are free):

1. Append the objects from `vocabulary-expansion-draft.js` to `SEED_VOCABULARY`
   in `data.js`. `status: 'draft'` is applied automatically for ids ≥ 65.
2. Merge `EXPANSION_MANDARIN` into `MANDARIN_GLOSSES` and `EXPANSION_INDONESIAN`
   into `INDONESIAN_GLOSSES` (both in `data.js`). **Do not skip this** —
   `indonesian-test.js` asserts every seeded row has both glosses.
3. `node tools/vocab-coverage-test.js` → must read **4 passed, 0 failed**
4. `node tools/regression.js` → 29 suites, all green

Before you paste anything, read **REVIEW NOTES 1–6** at the bottom of
`vocabulary-expansion-draft.js`. Note 1 in particular: four Home entries can be
*MOVED* down from L2/L3 instead of written new, which is less unreviewed
Cantonese in front of a learner.

## Greetings (問候)

| id | L | Cantonese | Jyutping | English | Tagalog | 中文 | Bahasa | who speaks |  |
|---:|:-:|---|---|---|---|---|---|---|
| 143 | 2 | 唔使客氣 | m4 sai2 haak3 hei3 | You're welcome | Walang anuman | 不用客气 | Sama-sama | helper | 🙇 |
| 144 | 2 | 對唔住 | deoi3 m4 zyu6 | Sorry | Pasensya na | 对不起 | Maaf | helper | 😔 |
| 145 | 2 | 唔使 | m4 sai2 | No need / You don't have to | Hindi na kailangan | 不用 | Tidak perlu | either | 🙅 |
| 146 | 2 | 慢行 | maan6 haang4 | Goodbye (to someone leaving) | Ingat | 慢走 — 送客时说的话 | Hati-hati di jalan — diucapkan saat mengantar tamu pulang | either | 🚶 |
| 147 | 2 | 食咗飯未 | sik6 zo2 faan6 mei6 | Have you eaten yet? (a greeting) | Kumain ka na ba? | 吃饭了吗 — 这是问候，不是真的问吃饭 | Sudah makan belum? — ini sapaan, bukan pertanyaan soal makan | elderly | 🍚 |
| 148 | 3 | 唔好意思阻你 | m4 hou2 ji3 si1 zo2 nei5 | Sorry to bother you | Pasensya na sa abala | 不好意思打扰你 | Maaf mengganggu | helper | 🙏 |
| 149 | 3 | 有事就打電話俾我 | jau5 si6 zau6 daa2 din6 waa2 bei2 ngo5 | Call me if anything happens | Tumawag ka sa akin kung may mangyari | 有事就打电话给我 | Kalau ada apa-apa telepon saya | helper | 📞 |
| 150 | 3 | 小姐早晨 | siu2 ze2 zou2 san4 | Good morning, ma'am | Magandang umaga, ma'am | 小姐早上好 | Selamat pagi, Bu | helper | 🌅 |
| 151 | 3 | 唔該借借 | m4 goi1 ze3 ze3 | Excuse me, let me through | Makiray, makikiraan po | 请让一让 | Permisi, numpang lewat | helper | 🚶 |

**Notes:**
- **唔使** — The workhorse refusal. 唔使客氣 = "you're welcome"; bare 唔使 = "no need". Distinct from 唔好 (do not) — 唔使 means it is not necessary.
- **慢行** — Said TO the person leaving, the way 慢行 is used at a door or a lift. Not a literal instruction to walk slowly.
- **食咗飯未** — In Cantonese this is a greeting, not really a question about food. The expected answer is 食咗 (yes), not a menu.
- **小姐早晨** — The address term 小姐 goes BEFORE 早晨 — the reverse of English word order. Same pattern with 先生 (Mr) and 太太 (Mrs).

## Common (常用)

| id | L | Cantonese | Jyutping | English | Tagalog | 中文 | Bahasa | who speaks |  |
|---:|:-:|---|---|---|---|---|---|---|
| 152 | 2 | 好多 | hou2 do1 | A lot | Marami | 很多 | Banyak | either | 📚 |
| 153 | 2 | 太少 | taai3 siu2 | Too little | Kulang | 太少 | Terlalu sedikit | either | 🤏 |
| 154 | 2 | 冇問題 | mou5 man6 tai4 | No problem | Walang problema | 没问题 | Tidak masalah | helper | 👌 |
| 155 | 2 | 等我 | dang2 ngo5 | Wait for me | Hintayin mo ako | 等我 | Tunggu saya | elderly | ✋ |
| 156 | 2 | 等等 | dang2 dang2 | Hold on a moment | Teka lang | 等等 | Sebentar | either | ⏳ |
| 157 | 3 | 你講咩呀 | nei5 gong2 me1 aa3 | What did you say? | Ano ang sinabi mo? | 你说什么？ | Kamu bilang apa? | helper | ❓ |
| 158 | 3 | 唔該講慢啲 | m4 goi1 gong2 maan6 di1 | Please speak more slowly | Pakisuyo, dahan-dahan | 请说慢一点 | Tolong bicara lebih pelan | helper | 🐌 |
| 159 | 3 | 我唔係好明 | ngo5 m4 hai6 hou2 ming4 | I don't quite understand | Hindi ko lubos maintindihan | 我不太明白 | Saya kurang mengerti | helper | 🤔 |
| 160 | 3 | 係咁先喇 | hai6 gam3 sin1 laa3 | That's all for now | Iyon muna | 就先这样吧 — 结束对话时的固定说法 | Sudah, segitu dulu — penutup percakapan | either | 🙆 |

**Notes:**
- **係咁先喇** — A fixed closing phrase — 係咁先喇 ends a conversation or a task. Not composable from its parts.

## Cleaning (清潔)

| id | L | Cantonese | Jyutping | English | Tagalog | 中文 | Bahasa | who speaks |  |
|---:|:-:|---|---|---|---|---|---|---|
| 161 | 1 | 乾淨 | gon1 zeng6 | Clean | Malinis | 干净 | Bersih | either | ✨ |
| 162 | 1 | 污糟 | wu1 zou1 | Dirty | Marumi | 脏 | Kotor | either | 🧦 |
| 163 | 1 | 掃地 | sou2 dei2 | Sweep the floor | Magwalis | 扫地 | Menyapu | helper | 🧹 |
| 164 | 1 | 抹手 | maat3 sau2 | Wipe your hands | Punasan ang kamay | 擦手 | Lap tangan | elderly | 🧻 |

## Children (細路仔)

| id | L | Cantonese | Jyutping | English | Tagalog | 中文 | Bahasa | who speaks |  |
|---:|:-:|---|---|---|---|---|---|---|
| 165 | 1 | 媽媽 | maa1 maa1 | Mummy / Mother | Mommy / Nanay | 妈妈 | Mama / Ibu | either | 👩 |
| 166 | 1 | 爸爸 | baa1 baa1 | Daddy / Father | Daddy / Tatay | 爸爸 | Papa / Ayah | either | 👨 |
| 167 | 1 | 玩 | waan2 | Play | Maglaro | 玩 | Bermain | either | 🪀 |
| 168 | 1 | 喊 | haam3 | Cry | Umiyak | 哭 | Menangis | either | 😭 |

## Daily Life (日常)

| id | L | Cantonese | Jyutping | English | Tagalog | 中文 | Bahasa | who speaks |  |
|---:|:-:|---|---|---|---|---|---|---|
| 169 | 1 | 覺 | gaau3 | A sleep | Tulog | 觉 — 睡觉的觉 | Tidur — kata benda | either | 😴 |
| 170 | 1 | 衫 | saam1 | Clothes | Damit | 衣服 | Baju / Pakaian | either | 👕 |
| 171 | 1 | 着衫 | zoek3 saam1 | Put on clothes | Magbihis | 穿衣服 | Pakai baju | either | 🧥 |
| 172 | 1 | 刷牙 | caat3 ngaa4 | Brush teeth | Magsipilyo | 刷牙 | Sikat gigi | either | 🪥 |

## Shopping (買嘢)

| id | L | Cantonese | Jyutping | English | Tagalog | 中文 | Bahasa | who speaks |  |
|---:|:-:|---|---|---|---|---|---|---|
| 173 | 1 | 菜 | coi3 | Vegetables | Gulay | 菜 | Sayur | either | 🥬 |
| 174 | 1 | 魚 | jyu2 | Fish | Isda | 鱼 | Ikan | either | 🐟 |
| 175 | 1 | 肉 | juk6 | Meat | Karne | 肉 | Daging | either | 🥩 |
| 176 | 1 | 生果 | saang1 gwo2 | Fruit | Prutas | 水果 | Buah | either | 🍎 |

## Home (屋企)

| id | L | Cantonese | Jyutping | English | Tagalog | 中文 | Bahasa | who speaks |  |
|---:|:-:|---|---|---|---|---|---|---|
| 177 | 1 | 開 | hoi1 | Open / Turn on | Buksan | 开 | Buka / Nyalakan | either | 🔓 |
| 178 | 1 | 閂 | saan1 | Close / Shut | Isara | 关 — 关门、关盖 | Tutup — pintu atau tutup wadah | either | 🔒 |
| 179 | 1 | 房 | fong2 | Room | Kwarto | 房间 | Kamar | either | 🚪 |
| 180 | 1 | 大門 | daai6 mun4 | Front door | Pintuan | 大门 | Pintu depan | either | 🏠 |

**Notes:**
- **閂** — 閂 is the everyday door-and-lid verb in Cantonese; 關 appears in the seeded 關燈/關門. Worth teaching as a pair so she recognises both.
