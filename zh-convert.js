'use strict';
/**
 * CantoBuddy — tiny Traditional → Simplified Chinese converter.
 *
 * WHY THIS EXISTS
 * ---------------
 * /en teaches English to Hong Kong elders. Their meanings are written in
 * Traditional Chinese (`en_vocabulary.cantonese`). A smaller group of elders
 * from the mainland reads Simplified Chinese. EN-ROADMAP.md §0b closes that
 * gap with an `en_vocabulary.meaning_sc` column.
 *
 * The site has NO build step and NO third-party Chinese-conversion dependency
 * (package.json has exactly two: express and express-session). Rather than add
 * OpenCC, this module carries the single-character pairs that actually occur in
 * the /en seed corpus plus the small set used by the elder content. Characters
 * it does not know pass through unchanged — which is correct for the ~90% of
 * Chinese characters that are identical in both scripts, and for Cantonese-only
 * characters (咗、啲、哋、喺、攰、畀 …) that have no Simplified variant.
 *
 * It is deliberately CHARACTER-level, not phrase-level. Hong Kong vs mainland
 * vocabulary differences (雪櫃/冰箱, 巴士/公交) are NOT "script" differences
 * and must not be silently rewritten: an elder in Hong Kong still says 雪櫃.
 * Phrase-level localisation belongs in the editor, not in a converter.
 *
 * This is a server-side module: the API returns BOTH scripts and the client
 * picks one, so the browser never needs to ship a conversion table.
 */

/**
 * [Traditional, Simplified] pairs. Duplicated keys are a bug, so the module
 * throws at load time rather than letting the last one silently win.
 */
const PAIRS = [
  // -- every differing character in en-data.js SEED_EN_VOCABULARY ----------
  ['謝', '谢'], ['該', '该'], ['請', '请'], ['對', '对'], ['係', '系'],
  ['幾', '几'], ['錢', '钱'], ['櫃', '柜'], ['爐', '炉'], ['電', '电'],
  ['飯', '饭'], ['鑊', '镬'], ['龍', '龙'], ['頭', '头'], ['潔', '洁'],
  ['檯', '台'], ['櫈', '凳'], ['馬', '马'], ['廁', '厕'], ['紙', '纸'],
  ['灑', '洒'], ['梘', '枧'], ['鏡', '镜'], ['單', '单'], ['屜', '屉'],
  ['燈', '灯'], ['鐘', '钟'], ['發', '发'], ['視', '视'], ['遙', '遥'],
  ['風', '风'], ['簾', '帘'], ['機', '机'], ['籃', '篮'], ['燙', '烫'],
  ['魚', '鱼'], ['雞', '鸡'], ['麵', '面'], ['鹽', '盐'], ['裝', '装'],
  ['話', '话'], ['幫', '帮'], ['護', '护'], ['車', '车'], ['險', '险'],
  ['醫', '医'], ['聽', '听'], ['晝', '昼'], ['鐵', '铁'], ['熱', '热'],
  ['陽', '阳'], ['開', '开'], ['餓', '饿'], ['講', '讲'], ['掃', '扫'],
  ['換', '换'], ['補', '补'], ['鋪', '铺'], ['執', '执'], ['摺', '折'],
  ['關', '关'], ['傢', '家'], ['俬', '私'], ['買', '买'], ['貴', '贵'],
  ['邊', '边'], ['級', '级'], ['場', '场'], ['孫', '孙'], ['燭', '烛'],
  // -- common characters an operator may type when adding new words --------
  ['學', '学'], ['習', '习'], ['詞', '词'], ['語', '语'], ['廣', '广'],
  ['東', '东'], ['灣', '湾'], ['臺', '台'], ['體', '体'], ['藥', '药'],
  ['號', '号'], ['碼', '码'], ['點', '点'], ['歲', '岁'], ['長', '长'],
  ['們', '们'], ['個', '个'], ['這', '这'], ['裡', '里'], ['裏', '里'],
  ['麼', '么'], ['樣', '样'], ['應', '应'], ['覺', '觉'], ['記', '记'],
  ['說', '说'], ['讀', '读'], ['寫', '写'], ['見', '见'], ['還', '还'],
  ['進', '进'], ['過', '过'], ['問', '问'], ['間', '间'], ['門', '门'],
  ['無', '无'], ['為', '为'], ['與', '与'], ['從', '从'], ['後', '后'],
  ['讓', '让'], ['給', '给'], ['帶', '带'], ['賣', '卖'], ['樂', '乐'],
  ['歡', '欢'], ['興', '兴'], ['識', '识'], ['驗', '验'], ['檢', '检'],
  ['淨', '净'], ['鬆', '松'], ['適', '适'], ['準', '准'], ['備', '备'],
  ['緊', '紧'], ['撥', '拨'], ['時', '时'], ['電', '电'], ['話', '话'],
  ['難', '难'], ['題', '题'], ['簡', '简'], ['單', '单'], ['顯', '显'],
  ['壺', '壶'], ['沖', '冲'], ['諗', '谂'], ['揀', '拣'], ['濕', '湿'],
  ['乾', '干'], ['凍', '冻'], ['溫', '温'], ['涼', '凉'], ['傘', '伞'],
  ['襪', '袜'], ['褲', '裤'], ['繩', '绳'], ['廚', '厨'], ['廳', '厅'],
  ['牆', '墙'], ['鎖', '锁'], ['櫥', '橱'], ['掃', '扫'], ['摺', '折'],
];

// Multi-character pairs above would corrupt a per-character map. Reject them
// and the duplicated keys at load time: a silent wrong conversion here ends up
// in front of an elderly reader, and there is no spell-checker for that.
const CONVERT = new Map();
for (const [trad, simp] of PAIRS) {
  if ([...trad].length !== 1 || [...simp].length !== 1) {
    throw new Error(`zh-convert: PAIRS must be single characters, got ${trad}/${simp}`);
  }
  if (CONVERT.has(trad) && CONVERT.get(trad) !== simp) {
    throw new Error(`zh-convert: conflicting mapping for ${trad}`);
  }
  CONVERT.set(trad, simp);
}

/** Convert Traditional Chinese text to Simplified, leaving unknown characters intact. */
function toSimplified(text) {
  const s = String(text == null ? '' : text);
  let out = '';
  for (const ch of s) out += CONVERT.get(ch) || ch;
  return out;
}

/** True when the text contains at least one character this module rewrites. */
function hasTraditionalOnly(text) {
  for (const ch of String(text == null ? '' : text)) if (CONVERT.has(ch)) return true;
  return false;
}

module.exports = { toSimplified, hasTraditionalOnly, CONVERT, PAIRS };
