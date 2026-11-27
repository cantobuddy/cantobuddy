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
  // -- /ch new-arrivals shelf: every differing character in ch-content.js ----
  // Generated from the authored Traditional corpus, one character at a time.
  // Phrase-level localisation (雪櫃/冰箱, 巴士/公交) is deliberately NOT here:
  // a Hong Kong newcomer still hears 雪櫃 and 小巴, and those are not script
  // differences. Unknown characters keep passing through unchanged.
  ['並', '并'], ['佈', '布'], ['來', '来'], ['僱', '雇'], ['價', '价'],
  ['優', '优'], ['兒', '儿'], ['內', '内'], ['兩', '两'], ['冊', '册'],
  ['別', '别'], ['則', '则'], ['剛', '刚'], ['劃', '划'], ['劇', '剧'],
  ['動', '动'], ['務', '务'], ['勞', '劳'], ['勢', '势'], ['區', '区'],
  ['協', '协'], ['參', '参'], ['員', '员'], ['園', '园'], ['圖', '图'],
  ['報', '报'], ['夠', '够'], ['宮', '宫'], ['實', '实'], ['將', '将'],
  ['專', '专'], ['尋', '寻'], ['導', '导'], ['屬', '属'], ['島', '岛'],
  ['崗', '岗'], ['帳', '帐'], ['廂', '厢'], ['張', '张'], ['強', '强'],
  ['徑', '径'], ['慣', '惯'], ['慮', '虑'], ['慶', '庆'], ['憶', '忆'],
  ['戶', '户'], ['撳', '揿'], ['擴', '扩'], ['數', '数'], ['曆', '历'],
  ['書', '书'], ['會', '会'], ['條', '条'], ['業', '业'], ['構', '构'],
  ['樓', '楼'], ['檔', '档'], ['歷', '历'], ['氣', '气'], ['況', '况'],
  ['減', '减'], ['湯', '汤'], ['溝', '沟'], ['現', '现'], ['環', '环'],
  ['畫', '画'], ['當', '当'], ['確', '确'], ['禮', '礼'], ['種', '种'],
  ['稱', '称'], ['積', '积'], ['穩', '稳'], ['節', '节'], ['篩', '筛'],
  ['簽', '签'], ['粵', '粤'], ['約', '约'], ['紅', '红'], ['細', '细'],
  ['紹', '绍'], ['組', '组'], ['結', '结'], ['絡', '络'], ['經', '经'],
  ['綠', '绿'], ['網', '网'], ['綵', '彩'], ['線', '线'], ['練', '练'],
  ['總', '总'], ['織', '织'], ['繫', '系'], ['續', '续'], ['義', '义'],
  ['聞', '闻'], ['聯', '联'], ['職', '职'], ['舉', '举'], ['華', '华'],
  ['蓋', '盖'], ['蔥', '葱'], ['薦', '荐'], ['藝', '艺'], ['處', '处'],
  ['術', '术'], ['規', '规'], ['親', '亲'], ['覽', '览'], ['觀', '观'],
  ['觸', '触'], ['訂', '订'], ['計', '计'], ['訊', '讯'], ['討', '讨'],
  ['訓', '训'], ['託', '托'], ['訪', '访'], ['設', '设'], ['許', '许'],
  ['訴', '诉'], ['註', '注'], ['評', '评'], ['詢', '询'], ['試', '试'],
  ['認', '认'], ['課', '课'], ['論', '论'], ['諮', '谘'], ['證', '证'],
  ['議', '议'], ['負', '负'], ['責', '责'], ['費', '费'], ['貼', '贴'],
  ['資', '资'], ['輔', '辅'], ['輪', '轮'], ['輸', '输'], ['轉', '转'],
  ['辦', '办'], ['連', '连'], ['週', '周'], ['遊', '游'], ['運', '运'],
  ['達', '达'], ['遞', '递'], ['選', '选'], ['郵', '邮'], ['鄉', '乡'],
  ['鄰', '邻'], ['鈴', '铃'], ['銀', '银'], ['錶', '表'], ['闊', '阔'],
  ['陣', '阵'], ['際', '际'], ['隨', '随'], ['離', '离'], ['頁', '页'],
  ['項', '项'], ['願', '愿'], ['類', '类'], ['飲', '饮'], ['餘', '余'],
  ['館', '馆'], ['騙', '骗'], ['鬧', '闹'], ['齊', '齐'],
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
