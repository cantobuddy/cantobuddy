/**
 * Posts for the four "practical" channels, in four languages.
 *
 * These live in their own file rather than in data.js because that seed is
 * already ~400KB and is about vocabulary, not articles. data.js pushes this
 * array into SEED_POSTS, and seedPostsIfNeeded() inserts any slug it has not
 * seen — so adding a post here is enough to publish it.
 *
 * The channel keys MUST exist in POST_CHANNELS in db.js, and each channel
 * should be listed in practical-channels.js so it appears on the Living shelf.
 *
 * House style, learned from the posts that came before:
 *   - four <h2> blocks: the hook, the words, a tip, and an honest/funny note
 *   - real Cantonese with jyutping, because a phrase she cannot say is useless
 *   - no lecture. She is an adult doing a hard job; talk to her like one.
 */

module.exports = [
  // =========================================================================
  // SURVIVAL PHRASES
  // =========================================================================
  {
    slug: 'cantonese-survival-phrases-directions',
    channel: 'survival-phrases',
    icon: '🧭',
    status: 'published',
    published_at: '2026-11-02T09:00:00.000Z',
    title_en: 'Getting Unlost: Cantonese for Asking Directions',
    title_fil: 'Hindi Mawala: Cantonese para sa Pagtatanong ng Daan',
    title_zh: '不会迷路：问路粤语',
    title_id: 'Tidak Tersesat: Bahasa Kanton untuk Bertanya Arah',
    summary_en:
      'You are at the wrong exit of the right MTR station. Three phrases turn a panic into a two-minute walk.',
    summary_fil:
      'Nasa maling exit ka ng tamang istasyon ng MTR. Tatlong parirala lang, dalawang minutong lakad na lang.',
    summary_zh: '你在对的地铁站、错的出口。三句话，就把慌乱变成两分钟的步行。',
    summary_id:
      'Anda di pintu keluar yang salah dari stasiun MTR yang benar. Tiga frasa mengubah panik menjadi jalan kaki dua menit.',
    body_en: `<p>Hong Kong exits are a trap. Exit B and exit F of the same station can be fifteen minutes apart, on opposite sides of a motorway, with no way to cross. You surface, you see nothing you recognise, and the map on your phone rotates every time you move.</p>
<h2>🧭 The three that get you out</h2>
<ul>
<li><strong>呢度點去？</strong> <em>ni1 dou6 dim2 heoi3</em> — "How do I get to here?" Show the address on your phone while you say it. Pointing beats pronouncing.</li>
<li><strong>邊個出口？</strong> <em>bin1 go3 ceot1 hau2</em> — "Which exit?" The single most useful question in the whole MTR system.</li>
<li><strong>遠唔遠？</strong> <em>jyun5 m4 jyun5</em> — "Is it far?" Ask this before you walk, not after.</li>
</ul>
<h2>🧍 The four words you will hear back</h2>
<ul>
<li><strong>直行</strong> <em>zik6 haang4</em> — go straight</li>
<li><strong>轉左</strong> <em>zyun3 zo2</em> — turn left</li>
<li><strong>轉右</strong> <em>zyun3 jau6</em> — turn right</li>
<li><strong>對面</strong> <em>deoi3 min6</em> — opposite / across the road</li>
</ul>
<h2>💡 The trick nobody tells you</h2>
<p>Hong Kong directions are given in landmarks, not street names. You will be told "behind the 7-Eleven, under the bridge, next to the fruit stall" — and that is a complete, accurate answer. Listen for the shop, not the road.</p>
<h2>😄 The honest truth</h2>
<p>You will be told <strong>好近</strong> <em>hou2 kan5</em> — "very near" — and then walk for twenty minutes. Do not take it personally. 好近 is a feeling, not a distance. In a city this dense, twenty minutes really is near.</p>`,
    body_fil: `<p>Bitag ang mga exit sa Hong Kong. Ang Exit B at Exit F ng isang istasyon ay maaaring labinlimang minuto ang layo, magkabilang side ng highway, at walang tawiran. Lalabas ka, walang makikilala, at paikot-ikot ang mapa sa telepono mo.</p>
<h2>🧭 Ang tatlong makakalabas sa iyo</h2>
<ul>
<li><strong>呢度點去？</strong> <em>ni1 dou6 dim2 heoi3</em> — "Paano pumunta dito?" Ipakita ang address sa telepono habang sinasabi. Mas malinaw ang turo kaysa bigkas.</li>
<li><strong>邊個出口？</strong> <em>bin1 go3 ceot1 hau2</em> — "Aling exit?" Ito ang pinakamahalagang tanong sa buong MTR.</li>
<li><strong>遠唔遠？</strong> <em>jyun5 m4 jyun5</em> — "Malayo ba?" Itanong bago maglakad, hindi pagkatapos.</li>
</ul>
<h2>🧍 Ang apat na maririnig mo pabalik</h2>
<ul>
<li><strong>直行</strong> <em>zik6 haang4</em> — dumiretso</li>
<li><strong>轉左</strong> <em>zyun3 zo2</em> — kumaliwa</li>
<li><strong>轉右</strong> <em>zyun3 jau6</em> — kumanan</li>
<li><strong>對面</strong> <em>deoi3 min6</em> — katapat / kabilang kalsada</li>
</ul>
<h2>💡 Ang trick na hindi sinasabi</h2>
<p>Ang direksyon sa Hong Kong ay binibigay sa pamamagitan ng tindahan, hindi ng pangalan ng kalsada. Sasabihin sa iyo: "sa likod ng 7-Eleven, sa ilalim ng tulay, katabi ng tindahan ng prutas" — at kumpleto at tama iyon. Makinig sa tindahan, hindi sa kalsada.</p>
<h2>😄 Ang totoo</h2>
<p>Sasabihin sa iyong <strong>好近</strong> <em>hou2 kan5</em> — "malapit lang" — tapos dalawampung minuto kang maglalakad. Huwag mong personalin. Ang 好近 ay pakiramdam, hindi distansya. Sa ganitong kakapal na lungsod, malapit talaga ang dalawampung minuto.</p>`,
    body_zh: `<p>香港的出口是个陷阱。同一个站的 B 出口和 F 出口，可能隔着一条高速公路，相距十五分钟，而且没有天桥。你走出来，什么都认不出，手机地图还跟着你转。</p>
<h2>🧭 三句就能脱身</h2>
<ul>
<li><strong>呢度點去？</strong> <em>ni1 dou6 dim2 heoi3</em>——「这里怎么去？」说的时候把手机上的地址给对方看。指比念有用。</li>
<li><strong>邊個出口？</strong> <em>bin1 go3 ceot1 hau2</em>——「哪个出口？」整个地铁系统里最有用的一句。</li>
<li><strong>遠唔遠？</strong> <em>jyun5 m4 jyun5</em>——「远不远？」走路之前问，不是走完才问。</li>
</ul>
<h2>🧍 你会听到的四个词</h2>
<ul>
<li><strong>直行</strong> <em>zik6 haang4</em>——直走</li>
<li><strong>轉左</strong> <em>zyun3 zo2</em>——左转</li>
<li><strong>轉右</strong> <em>zyun3 jau6</em>——右转</li>
<li><strong>對面</strong> <em>deoi3 min6</em>——对面</li>
</ul>
<h2>💡 没人告诉你的小技巧</h2>
<p>香港人指路用店，不用街名。你会听到「7-Eleven 后面、天桥下面、水果档旁边」——这就是完整而准确的答案。听店名，别听路名。</p>
<h2>😄 实话</h2>
<p>你会被告知<strong>好近</strong> <em>hou2 kan5</em>——「很近」——然后走二十分钟。别往心里去。好近是感觉，不是距离。这么密的城市里，二十分钟确实算近。</p>`,
    body_id: `<p>Pintu keluar di Hong Kong itu jebakan. Exit B dan Exit F di stasiun yang sama bisa terpaut lima belas menit, di sisi berlawanan jalan tol, tanpa penyeberangan. Anda naik ke permukaan, tidak mengenali apa pun, dan peta di ponsel berputar setiap kali Anda bergerak.</p>
<h2>🧭 Tiga frasa untuk keluar</h2>
<ul>
<li><strong>呢度點去？</strong> <em>ni1 dou6 dim2 heoi3</em> — "Bagaimana ke sini?" Tunjukkan alamat di ponsel sambil bicara. Menunjuk lebih ampuh daripada melafalkan.</li>
<li><strong>邊個出口？</strong> <em>bin1 go3 ceot1 hau2</em> — "Exit yang mana?" Pertanyaan paling berguna di seluruh sistem MTR.</li>
<li><strong>遠唔遠？</strong> <em>jyun5 m4 jyun5</em> — "Jauh tidak?" Tanya sebelum berjalan, bukan sesudahnya.</li>
</ul>
<h2>🧍 Empat kata yang akan Anda dengar</h2>
<ul>
<li><strong>直行</strong> <em>zik6 haang4</em> — lurus terus</li>
<li><strong>轉左</strong> <em>zyun3 zo2</em> — belok kiri</li>
<li><strong>轉右</strong> <em>zyun3 jau6</em> — belok kanan</li>
<li><strong>對面</strong> <em>deoi3 min6</em> — seberang</li>
</ul>
<h2>💡 Trik yang tidak diberitahu</h2>
<p>Orang Hong Kong memberi arah lewat toko, bukan nama jalan. Anda akan diberi tahu "di belakang 7-Eleven, di bawah jembatan, sebelah lapak buah" — dan itu jawaban yang lengkap dan akurat. Dengarkan tokonya, bukan jalannya.</p>
<h2>😄 Sejujurnya</h2>
<p>Anda akan diberi tahu <strong>好近</strong> <em>hou2 kan5</em> — "dekat sekali" — lalu berjalan dua puluh menit. Jangan dimasukkan hati. 好近 itu perasaan, bukan jarak. Di kota sepadat ini, dua puluh menit memang dekat.</p>`,
  },

  {
    slug: 'cantonese-survival-phrases-phone',
    channel: 'survival-phrases',
    icon: '📞',
    status: 'published',
    published_at: '2026-11-02T10:00:00.000Z',
    title_en: 'Answering the Phone in Cantonese Without Freezing',
    title_fil: 'Pagsagot sa Telepono sa Cantonese Nang Hindi Nagpapanic',
    title_zh: '接电话不慌：粤语电话用语',
    title_id: 'Menjawab Telepon dalam Bahasa Kanton Tanpa Panik',
    summary_en:
      'The phone rings, you say hello, and then a fast voice asks for your employer. Here is what to say next.',
    summary_fil:
      'Tumunog ang telepono, magsasabi ka ng hello, at may mabilis na tinig na magtatanong para sa amo mo. Ito ang isasagot.',
    summary_zh: '电话响了，你说「喂」，然后一串飞快的话在找你雇主。接下来该说什么。',
    summary_id:
      'Telepon berbunyi, Anda bilang halo, lalu suara cepat menanyakan majikan Anda. Inilah yang harus dikatakan.',
    body_en: `<p>The phone is harder than a conversation because you cannot see a face, you cannot point, and the voice is compressed into a tinny buzz. The first three seconds decide whether you sound like you work there or like you are hiding.</p>
<h2>📞 The words on the phone</h2>
<ul>
<li><strong>喂</strong> <em>wai2</em> — hello. On the phone ONLY. Saying it face to face is odd.</li>
<li><strong>邊位？</strong> <em>bin1 wai2</em> — "Who is calling?"</li>
<li><strong>等陣</strong> <em>dang2 zan6</em> — "One moment." Your most valuable two syllables.</li>
<li><strong>佢唔得閒</strong> <em>keoi5 m4 dak1 haan4</em> — "She is not available."</li>
<li><strong>你貴姓？</strong> <em>nei5 gwai3 sing3</em> — "May I have your surname?" Polite, and it buys you time.</li>
<li><strong>我幫你留言</strong> <em>ngo5 bong1 nei5 lau4 jin4</em> — "I will take a message."</li>
</ul>
<h2>💡 The habit that saves you</h2>
<p>Write the name and number down, then read them back before you hang up. Cantonese names are easy to mishear on a bad line, and a call that was never passed on is the mistake that gets remembered.</p>
<h2>😄 The honest truth</h2>
<p>Nobody expects you to hold a fluent phone conversation in your first month. They expect <strong>等陣</strong> and then your employer's voice. That is a complete, correct, professional answer — and it is three syllables long.</p>`,
    body_fil: `<p>Mas mahirap ang telepono kaysa usapan dahil walang mukhang makikita, walang matuturo, at manipis ang tunog. Ang unang tatlong segundo ang magpapasya kung mukha kang nagtatrabaho doon o nagtatago.</p>
<h2>📞 Ang mga salita sa telepono</h2>
<ul>
<li><strong>喂</strong> <em>wai2</em> — hello. TELEPONO lang. Kakaiba kung sasabihin mo ito nang harapan.</li>
<li><strong>邊位？</strong> <em>bin1 wai2</em> — "Sino po ang tumatawag?"</li>
<li><strong>等陣</strong> <em>dang2 zan6</em> — "Sandali lang." Ito ang pinakamahalagang dalawang pantig mo.</li>
<li><strong>佢唔得閒</strong> <em>keoi5 m4 dak1 haan4</em> — "Hindi siya available."</li>
<li><strong>你貴姓？</strong> <em>nei5 gwai3 sing3</em> — "Ano po ang apelyido ninyo?" Magalang, at nakakabili ng oras.</li>
<li><strong>我幫你留言</strong> <em>ngo5 bong1 nei5 lau4 jin4</em> — "Kukuha ako ng mensahe."</li>
</ul>
<h2>💡 Ang ugaling makakaligtas sa iyo</h2>
<p>Isulat ang pangalan at numero, tapos ulitin bago ibaba ang telepono. Madaling mamalikmata ang pangalang Cantonese sa mahinang linya, at ang mensaheng hindi naipasa ang siyang natatandaan.</p>
<h2>😄 Ang totoo</h2>
<p>Walang umaasang magiging matatas ka sa telepono sa unang buwan. Ang inaasahan nila: <strong>等陣</strong> at pagkatapos ay boses ng amo mo. Kumpleto, tama, at propesyonal na sagot iyon — tatlong pantig lang.</p>`,
    body_zh: `<p>电话比面对面难，因为你看不到脸、指不了东西，声音还被压成一层薄薄的杂音。前三秒就决定了你听起来像在这里工作，还是像在躲。</p>
<h2>📞 电话上的词</h2>
<ul>
<li><strong>喂</strong> <em>wai2</em>——喂。只用在电话上，面对面说会很怪。</li>
<li><strong>邊位？</strong> <em>bin1 wai2</em>——「哪位？」</li>
<li><strong>等陣</strong> <em>dang2 zan6</em>——「等一下。」你最值钱的两个字。</li>
<li><strong>佢唔得閒</strong> <em>keoi5 m4 dak1 haan4</em>——「她现在不方便。」</li>
<li><strong>你貴姓？</strong> <em>nei5 gwai3 sing3</em>——「贵姓？」礼貌，而且能拖时间。</li>
<li><strong>我幫你留言</strong> <em>ngo5 bong1 nei5 lau4 jin4</em>——「我帮你留言。」</li>
</ul>
<h2>💡 救命的习惯</h2>
<p>把名字和号码写下来，挂电话前念一遍。粤语名字在信号差时特别容易听错，而一通没转达的电话，是会被记住的那种错。</p>
<h2>😄 实话</h2>
<p>没人指望你第一个月就能在电话里对答如流。他们等的是<strong>等陣</strong>，然后是雇主的声音。这就是完整、正确、专业的回答——一共三个字。</p>`,
    body_id: `<p>Telepon lebih sulit daripada percakapan karena Anda tidak bisa melihat wajah, tidak bisa menunjuk, dan suara terkompresi jadi dengung tipis. Tiga detik pertama menentukan apakah Anda terdengar bekerja di sana atau bersembunyi.</p>
<h2>📞 Kata-kata di telepon</h2>
<ul>
<li><strong>喂</strong> <em>wai2</em> — halo. HANYA di telepon. Mengucapkannya tatap muka terasa aneh.</li>
<li><strong>邊位？</strong> <em>bin1 wai2</em> — "Siapa yang menelepon?"</li>
<li><strong>等陣</strong> <em>dang2 zan6</em> — "Sebentar." Dua suku kata paling berharga Anda.</li>
<li><strong>佢唔得閒</strong> <em>keoi5 m4 dak1 haan4</em> — "Dia sedang tidak bisa."</li>
<li><strong>你貴姓？</strong> <em>nei5 gwai3 sing3</em> — "Nama keluarga Anda siapa?" Sopan, dan membeli waktu.</li>
<li><strong>我幫你留言</strong> <em>ngo5 bong1 nei5 lau4 jin4</em> — "Saya catat pesannya."</li>
</ul>
<h2>💡 Kebiasaan yang menyelamatkan</h2>
<p>Tulis nama dan nomornya, lalu bacakan ulang sebelum menutup telepon. Nama Kanton mudah salah dengar di saluran buruk, dan pesan yang tidak diteruskan adalah kesalahan yang diingat.</p>
<h2>😄 Sejujurnya</h2>
<p>Tidak ada yang mengharapkan Anda lancar menelepon di bulan pertama. Yang mereka tunggu: <strong>等陣</strong> lalu suara majikan Anda. Itu jawaban lengkap, benar, dan profesional — hanya tiga suku kata.</p>`,
  },

  {
    slug: 'cantonese-survival-phrases-money',
    channel: 'survival-phrases',
    icon: '💰',
    status: 'published',
    published_at: '2026-11-02T11:00:00.000Z',
    title_en: 'Money Talk: Paying, Change and the Octopus Card',
    title_fil: 'Usapan Pera: Pagbabayad, Sukli at ang Octopus Card',
    title_zh: '钱的对话：付款、找零与八达通',
    title_id: 'Bicara Uang: Membayar, Kembalian, dan Kartu Octopus',
    summary_en:
      'Cash, Octopus, and the small embarrassment of holding up the queue. Four phrases and one habit.',
    summary_fil:
      'Cash, Octopus, at ang maliit na hiya ng pagharang sa pila. Apat na parirala at isang ugali.',
    summary_zh: '现金、八达通，还有堵住队伍时那点小小的尴尬。四句话，一个习惯。',
    summary_id:
      'Tunai, Octopus, dan rasa malu kecil karena menahan antrean. Empat frasa dan satu kebiasaan.',
    body_en: `<p>Hong Kong runs on a plastic card and a lot of coins. The good news is that money words are short, and the numbers are the ones you already know from counting.</p>
<h2>💰 The four you will actually use</h2>
<ul>
<li><strong>幾多錢？</strong> <em>gei2 do1 cin2</em> — "How much?"</li>
<li><strong>唔使找</strong> <em>m4 sai2 zaau2</em> — "Keep the change."</li>
<li><strong>八達通</strong> <em>baat3 daat6 tung1</em> — Octopus card.</li>
<li><strong>可唔可以刷卡？</strong> <em>ho2 m4 ho2 ji5 caat3 kaat1</em> — "Can I pay by card?"</li>
</ul>
<h2>💳 The one word that unlocks everything</h2>
<p><strong>增值</strong> <em>zang1 zik6</em> — top up. Say it at any 7-Eleven counter, hand over the card and a note, and you are done. No sentence needed.</p>
<h2>💡 The habit that saves you</h2>
<p>Break big notes at a chain shop, never at a noodle stall. Many small places genuinely cannot make change for $500, and the look you get is not rudeness — it is arithmetic.</p>
<h2>😄 The honest truth</h2>
<p>You will at some point hand over a $100 note for a $12 drink and watch the vendor sigh. Everyone has done it. The fix is simple: keep a pocket of coins and $20 notes, and the queue will love you.</p>`,
    body_fil: `<p>Umiikot ang Hong Kong sa plastik na card at napakaraming barya. Mabuti na lang, maikli ang mga salita sa pera, at ang numero ay iyong alam mo na sa pagbilang.</p>
<h2>💰 Ang apat na talagang gagamitin mo</h2>
<ul>
<li><strong>幾多錢？</strong> <em>gei2 do1 cin2</em> — "Magkano?"</li>
<li><strong>唔使找</strong> <em>m4 sai2 zaau2</em> — "Keep the change."</li>
<li><strong>八達通</strong> <em>baat3 daat6 tung1</em> — Octopus card.</li>
<li><strong>可唔可以刷卡？</strong> <em>ho2 m4 ho2 ji5 caat3 kaat1</em> — "Pwede bang card?"</li>
</ul>
<h2>💳 Ang isang salitang nagbubukas ng lahat</h2>
<p><strong>增值</strong> <em>zang1 zik6</em> — mag-top up. Sabihin sa counter ng 7-Eleven, iabot ang card at ang papel, tapos na. Walang kailangang pangungusap.</p>
<h2>💡 Ang ugaling makakaligtas sa iyo</h2>
<p>Magpabarya ng malaking papel sa chain store, hindi sa karinderya. Maraming maliit na tindahan ang talagang walang sukli sa $500, at ang tingin nila ay hindi kabastusan — aritmetika lang.</p>
<h2>😄 Ang totoo</h2>
<p>May pagkakataong mag-aabot ka ng $100 para sa $12 na inumin at mapapabuntong-hininga ang tindera. Nagawa na ito ng lahat. Ang solusyon: magtabi ng barya at $20 na papel, at mamahalin ka ng pila.</p>`,
    body_zh: `<p>香港靠一张塑胶卡和一大堆硬币运转。好消息是，钱的词都很短，数字也都是你早就会数的。</p>
<h2>💰 真正用得上的四句</h2>
<ul>
<li><strong>幾多錢？</strong> <em>gei2 do1 cin2</em>——「多少钱？」</li>
<li><strong>唔使找</strong> <em>m4 sai2 zaau2</em>——「不用找了。」</li>
<li><strong>八達通</strong> <em>baat3 daat6 tung1</em>——八达通。</li>
<li><strong>可唔可以刷卡？</strong> <em>ho2 m4 ho2 ji5 caat3 kaat1</em>——「可以刷卡吗？」</li>
</ul>
<h2>💳 一个词走遍全城</h2>
<p><strong>增值</strong> <em>zang1 zik6</em>——充值。在任何 7-Eleven 柜台说这个词，递上卡和纸币，就完成了。不用说整句。</p>
<h2>💡 救命的习惯</h2>
<p>大钞去连锁店破，别去面档。很多小店真的找不开五百块，对方的表情不是没礼貌，是在算数。</p>
<h2>😄 实话</h2>
<p>你总会有一次拿一百块买十二块的饮料，然后看着老板叹气。每个人都干过。解决办法很简单：口袋里备些硬币和二十块，队伍会爱你。</p>`,
    body_id: `<p>Hong Kong berjalan dengan kartu plastik dan banyak koin. Kabar baiknya, kata-kata soal uang itu pendek, dan angkanya sudah Anda kenal dari berhitung.</p>
<h2>💰 Empat yang benar-benar akan dipakai</h2>
<ul>
<li><strong>幾多錢？</strong> <em>gei2 do1 cin2</em> — "Berapa?"</li>
<li><strong>唔使找</strong> <em>m4 sai2 zaau2</em> — "Kembaliannya ambil saja."</li>
<li><strong>八達通</strong> <em>baat3 daat6 tung1</em> — Kartu Octopus.</li>
<li><strong>可唔可以刷卡？</strong> <em>ho2 m4 ho2 ji5 caat3 kaat1</em> — "Bisa bayar pakai kartu?"</li>
</ul>
<h2>💳 Satu kata yang membuka semuanya</h2>
<p><strong>增值</strong> <em>zang1 zik6</em> — isi ulang. Ucapkan di kasir 7-Eleven mana pun, serahkan kartu dan uangnya, selesai. Tidak perlu kalimat.</p>
<h2>💡 Kebiasaan yang menyelamatkan</h2>
<p>Pecahkan uang besar di toko jaringan, jangan di warung mi. Banyak tempat kecil benar-benar tidak bisa memberi kembalian untuk $500, dan tatapan yang Anda terima bukan kekasaran — itu aritmetika.</p>
<h2>😄 Sejujurnya</h2>
<p>Suatu saat Anda akan menyerahkan uang $100 untuk minuman $12 dan melihat penjualnya menghela napas. Semua orang pernah. Solusinya mudah: simpan koin dan uang $20, dan antrean akan menyayangi Anda.</p>`,
  },

  {
    slug: 'cantonese-survival-phrases-taxi-minibus',
    channel: 'survival-phrases',
    icon: '🚕',
    status: 'published',
    published_at: '2026-11-02T12:00:00.000Z',
    title_en: 'Taxis and Minibuses: Saying Where You Are Going',
    title_fil: 'Taxi at Minibus: Pagsasabi Kung Saan Ka Pupunta',
    title_zh: '的士与小巴：说清楚你要去哪',
    title_id: 'Taksi dan Minibus: Mengatakan Tujuan Anda',
    summary_en:
      'A taxi driver cannot read your mind and a minibus driver will not wait. Say the destination before you sit down.',
    summary_fil:
      'Hindi mababasa ng taxi driver ang isip mo, at hindi maghihintay ang minibus. Sabihin ang pupuntahan bago umupo.',
    summary_zh: '的士司机猜不到你的心思，小巴司机也不会等你。坐下之前，先说出目的地。',
    summary_id:
      'Pengemudi taksi tidak bisa membaca pikiran Anda, dan pengemudi minibus tidak akan menunggu. Sebutkan tujuan sebelum duduk.',
    body_en: `<p>Two vehicles, two completely different social rules. In a taxi you sit back and are driven. On a minibus you are part of the crew, and the crew must shout.</p>
<h2>🚕 In the taxi</h2>
<ul>
<li><strong>唔該，去…</strong> <em>m4 goi1, heoi3 …</em> — "Please, go to…" Say the place, then show the phone.</li>
<li><strong>前面落</strong> <em>cin4 min6 lok6</em> — "I will get off just ahead."</li>
<li><strong>呢度得喇</strong> <em>ni1 dou6 dak1 laa3</em> — "Here is fine."</li>
</ul>
<h2>🚌 On the minibus</h2>
<ul>
<li><strong>有落！</strong> <em>jau5 lok6</em> — "Stopping!" You must say it, loudly, and there is no bell to press.</li>
<li><strong>落車</strong> <em>lok6 ce1</em> — to get off</li>
<li><strong>唔該，開門</strong> <em>m4 goi1, hoi1 mun4</em> — "Please open the door."</li>
</ul>
<h2>💡 The trick nobody tells you</h2>
<p>Practise <strong>有落</strong> out loud at home, once, at the volume you would use across a room. The first time you need it you will be standing up, holding a bag, and the stop is in four seconds. Rehearsal is the whole game.</p>
<h2>😄 The honest truth</h2>
<p>Minibus drivers are the best drivers in the world and they know it. Sit down, hold the rail, and do not chat while they are moving. And if you say 有落 too quietly, you will ride to the terminus — a lovely tour you did not book.</p>`,
    body_fil: `<p>Dalawang sasakyan, dalawang magkaibang tuntunin. Sa taxi, uupo ka at ihahatid ka. Sa minibus, kasama ka sa tripulasyon, at kailangang sumigaw ng tripulasyon.</p>
<h2>🚕 Sa taxi</h2>
<ul>
<li><strong>唔該，去…</strong> <em>m4 goi1, heoi3 …</em> — "Paki, punta sa…" Sabihin ang lugar, tapos ipakita ang telepono.</li>
<li><strong>前面落</strong> <em>cin4 min6 lok6</em> — "Baba ako sa unahan."</li>
<li><strong>呢度得喇</strong> <em>ni1 dou6 dak1 laa3</em> — "Dito na lang."</li>
</ul>
<h2>🚌 Sa minibus</h2>
<ul>
<li><strong>有落！</strong> <em>jau5 lok6</em> — "Baba!" Kailangan mong sabihin ito, malakas, at walang button na pindutin.</li>
<li><strong>落車</strong> <em>lok6 ce1</em> — bumaba</li>
<li><strong>唔該，開門</strong> <em>m4 goi1, hoi1 mun4</em> — "Paki bukas ng pinto."</li>
</ul>
<h2>💡 Ang trick na hindi sinasabi</h2>
<p>Praktisin ang <strong>有落</strong> nang malakas sa bahay, isang beses, sa lakas na gagamitin mo sa kabilang kwarto. Sa unang pagkakataon, nakatayo ka, may bitbit, at apat na segundo na lang ang hinto. Ang ensayo ang lahat.</p>
<h2>😄 Ang totoo</h2>
<p>Ang mga minibus driver ang pinakamagagaling na driver sa mundo at alam nila iyon. Umupo, humawak sa rehas, at huwag makipag-usap habang umaandar. At kung masyadong mahina ang 有落 mo, dadalhin ka sa dulo — magandang tour na hindi mo binook.</p>`,
    body_zh: `<p>两种车，两套完全不同的规矩。的士上你坐着被载；小巴上你是船员之一，而船员必须喊。</p>
<h2>🚕 的士上</h2>
<ul>
<li><strong>唔該，去…</strong> <em>m4 goi1, heoi3 …</em>——「麻烦，去……」说出地名，再给他看手机。</li>
<li><strong>前面落</strong> <em>cin4 min6 lok6</em>——「前面下。」</li>
<li><strong>呢度得喇</strong> <em>ni1 dou6 dak1 laa3</em>——「这里就行。」</li>
</ul>
<h2>🚌 小巴上</h2>
<ul>
<li><strong>有落！</strong> <em>jau5 lok6</em>——「有下！」必须喊，而且要够响，车上没有铃可按。</li>
<li><strong>落車</strong> <em>lok6 ce1</em>——下车</li>
<li><strong>唔該，開門</strong> <em>m4 goi1, hoi1 mun4</em>——「麻烦开门。」</li>
</ul>
<h2>💡 没人告诉你的小技巧</h2>
<p>在家把<strong>有落</strong>大声练一次，用隔一个房间的音量。第一次真正要用时，你正站着、手上拎着东西，而站只剩四秒。练过就是全部。</p>
<h2>😄 实话</h2>
<p>小巴司机是世界上最好的司机，他们自己也知道。坐下、扶好，车在动的时候别聊天。还有——有落喊得太小声，你会坐到总站，一趟你没订的观光。</p>`,
    body_id: `<p>Dua kendaraan, dua aturan sosial yang sama sekali berbeda. Di taksi Anda duduk dan diantar. Di minibus Anda bagian dari kru, dan kru harus berseru.</p>
<h2>🚕 Di taksi</h2>
<ul>
<li><strong>唔該，去…</strong> <em>m4 goi1, heoi3 …</em> — "Tolong, ke…" Sebut tempatnya, lalu tunjukkan ponsel.</li>
<li><strong>前面落</strong> <em>cin4 min6 lok6</em> — "Saya turun di depan."</li>
<li><strong>呢度得喇</strong> <em>ni1 dou6 dak1 laa3</em> — "Di sini saja."</li>
</ul>
<h2>🚌 Di minibus</h2>
<ul>
<li><strong>有落！</strong> <em>jau5 lok6</em> — "Turun!" Harus diucapkan, keras, dan tidak ada tombol untuk ditekan.</li>
<li><strong>落車</strong> <em>lok6 ce1</em> — turun</li>
<li><strong>唔該，開門</strong> <em>m4 goi1, hoi1 mun4</em> — "Tolong buka pintunya."</li>
</ul>
<h2>💡 Trik yang tidak diberitahu</h2>
<p>Latih <strong>有落</strong> dengan suara keras di rumah, sekali, sekeras kalau memanggil dari seberang ruangan. Saat pertama kali dibutuhkan, Anda berdiri, membawa tas, dan halte tinggal empat detik. Latihannya adalah segalanya.</p>
<h2>😄 Sejujurnya</h2>
<p>Pengemudi minibus adalah pengemudi terbaik di dunia dan mereka tahu itu. Duduk, pegang pegangan, dan jangan mengobrol saat berjalan. Dan kalau 有落 Anda terlalu pelan, Anda akan sampai terminal — tur yang bagus yang tidak Anda pesan.</p>`,
  },

  // =========================================================================
  // WORK & HOUSEHOLD
  // =========================================================================
  {
    slug: 'cantonese-household-laundry',
    channel: 'work-household',
    icon: '🧼',
    status: 'published',
    published_at: '2026-11-02T13:00:00.000Z',
    title_en: 'Laundry in Cantonese: Wash, Dry, Iron, Repeat',
    title_fil: 'Labada sa Cantonese: Laba, Patuyo, Plantsa, Ulit',
    title_zh: '洗衣粤语：洗、晾、熨、再来一遍',
    title_id: 'Mencuci dalam Bahasa Kanton: Cuci, Jemur, Setrika, Ulang',
    summary_en:
      'Every Hong Kong flat dries clothes in a machine, on a rack, or out of a window. Ask which, and you will not shrink anything.',
    summary_fil:
      'Bawat flat sa Hong Kong ay nagpapatuyo ng damit sa makina, sa sampayan, o sa bintana. Itanong kung alin, at wala kang mapapaliit.',
    summary_zh: '香港每个单位都在烘干机里、晾衣架上或窗外晾衣服。先问清楚是哪一种，就不会洗坏任何一件。',
    summary_id:
      'Setiap flat di Hong Kong mengeringkan pakaian dengan mesin, rak, atau di luar jendela. Tanyakan yang mana, dan Anda tidak akan membuat apa pun menyusut.',
    body_en: `<p>Hong Kong has no space and a lot of humidity. That combination produces three different drying methods in three different flats, and using the wrong one on the wrong shirt is a very expensive Tuesday.</p>
<h2>🧼 The words</h2>
<ul>
<li><strong>洗衫</strong> <em>sai2 saam1</em> — wash clothes</li>
<li><strong>晾衫</strong> <em>long6 saam1</em> — hang clothes to dry</li>
<li><strong>乾衣機</strong> <em>gon1 ji1 gei1</em> — tumble dryer</li>
<li><strong>熨衫</strong> <em>tong3 saam1</em> — iron clothes</li>
<li><strong>深色 / 淺色</strong> <em>sam1 sik1 / cin2 sik1</em> — dark / light colours</li>
<li><strong>縮水</strong> <em>suk1 seoi2</em> — shrink</li>
</ul>
<h2>💡 The question to ask before the first wash</h2>
<p><strong>呢件可唔可以機洗？</strong> <em>ni1 gin6 ho2 m4 ho2 ji5 gei1 sai2</em> — "Can this be machine washed?" Ask it once per garment you have not washed before. It takes four seconds and prevents the one mistake nobody forgets.</p>
<h2>🌬️ Reading the weather like a local</h2>
<p>If the sky is that flat grey that means rain in twenty minutes, the rack comes in. Hong Kong rain does not arrive gradually; it arrives all at once, and your employer's work shirts are on it.</p>
<h2>😄 The honest truth</h2>
<p>The window rack is an art form. Hang one heavy towel on the outside and the whole thing becomes a sail. Nobody warns you, everybody has done it, and the towel is fine.</p>`,
    body_fil: `<p>Walang espasyo ang Hong Kong at sobrang humid. Ang kombinasyong iyon ay gumagawa ng tatlong paraan ng pagpapatuyo sa tatlong flat, at ang maling paraan sa maling damit ay isang mamahaling Martes.</p>
<h2>🧼 Ang mga salita</h2>
<ul>
<li><strong>洗衫</strong> <em>sai2 saam1</em> — maglaba</li>
<li><strong>晾衫</strong> <em>long6 saam1</em> — magsampay</li>
<li><strong>乾衣機</strong> <em>gon1 ji1 gei1</em> — dryer</li>
<li><strong>熨衫</strong> <em>tong3 saam1</em> — magplantsa</li>
<li><strong>深色 / 淺色</strong> <em>sam1 sik1 / cin2 sik1</em> — madilim / maliwanag na kulay</li>
<li><strong>縮水</strong> <em>suk1 seoi2</em> — lumiliit</li>
</ul>
<h2>💡 Ang itatanong bago ang unang laba</h2>
<p><strong>呢件可唔可以機洗？</strong> <em>ni1 gin6 ho2 m4 ho2 ji5 gei1 sai2</em> — "Pwede bang ilaba ito sa makina?" Itanong isang beses sa bawat damit na hindi mo pa nalalabhan. Apat na segundo lang, at napipigilan ang pagkakamaling walang nakakalimot.</p>
<h2>🌬️ Pagbasa ng panahon tulad ng lokal</h2>
<p>Kung kulay-abong plat ang langit na ibig sabihin ay uulan sa dalawampung minuto, papasukin ang sampayan. Hindi dahan-dahang dumarating ang ulan sa Hong Kong; sabay-sabay, at naroon ang mga polo ng amo mo.</p>
<h2>😄 Ang totoo</h2>
<p>Sining ang sampayan sa bintana. Magsabit ka ng isang mabigat na tuwalya sa labas at magiging layag ang buo. Walang nagbababala, nagawa na ito ng lahat, at ayos lang ang tuwalya.</p>`,
    body_zh: `<p>香港没有空间，却有很多湿气。这个组合让三个单位有三种晾衣方式，而用错方式洗错衬衫，就是一个很贵的星期二。</p>
<h2>🧼 这些词</h2>
<ul>
<li><strong>洗衫</strong> <em>sai2 saam1</em>——洗衣服</li>
<li><strong>晾衫</strong> <em>long6 saam1</em>——晾衣服</li>
<li><strong>乾衣機</strong> <em>gon1 ji1 gei1</em>——烘干机</li>
<li><strong>熨衫</strong> <em>tong3 saam1</em>——熨衣服</li>
<li><strong>深色 / 淺色</strong> <em>sam1 sik1 / cin2 sik1</em>——深色／浅色</li>
<li><strong>縮水</strong> <em>suk1 seoi2</em>——缩水</li>
</ul>
<h2>💡 第一次洗之前要问的那句</h2>
<p><strong>呢件可唔可以機洗？</strong> <em>ni1 gin6 ho2 m4 ho2 ji5 gei1 sai2</em>——「这件能机洗吗？」每件没洗过的衣服问一次。四秒钟，挡掉那个谁都不会忘的错。</p>
<h2>🌬️ 像本地人一样看天</h2>
<p>如果天是那种平平的灰——意思就是二十分钟后下雨——就把晾衣架收进来。香港的雨不是慢慢来的，是一次全下来，而雇主的衬衫就挂在上面。</p>
<h2>😄 实话</h2>
<p>窗外晾衣架是一门艺术。把一条厚毛巾挂在外侧，整架就变成帆。没人提醒你，每个人都干过，毛巾也没事。</p>`,
    body_id: `<p>Hong Kong tidak punya ruang dan punya banyak kelembapan. Kombinasi itu menghasilkan tiga cara menjemur di tiga flat berbeda, dan memakai cara yang salah untuk kemeja yang salah adalah hari Selasa yang sangat mahal.</p>
<h2>🧼 Kata-katanya</h2>
<ul>
<li><strong>洗衫</strong> <em>sai2 saam1</em> — mencuci pakaian</li>
<li><strong>晾衫</strong> <em>long6 saam1</em> — menjemur pakaian</li>
<li><strong>乾衣機</strong> <em>gon1 ji1 gei1</em> — mesin pengering</li>
<li><strong>熨衫</strong> <em>tong3 saam1</em> — menyetrika</li>
<li><strong>深色 / 淺色</strong> <em>sam1 sik1 / cin2 sik1</em> — gelap / terang</li>
<li><strong>縮水</strong> <em>suk1 seoi2</em> — menyusut</li>
</ul>
<h2>💡 Pertanyaan sebelum cucian pertama</h2>
<p><strong>呢件可唔可以機洗？</strong> <em>ni1 gin6 ho2 m4 ho2 ji5 gei1 sai2</em> — "Bisa dicuci mesin?" Tanyakan sekali untuk setiap pakaian yang belum pernah Anda cuci. Empat detik, dan mencegah kesalahan yang tidak dilupakan siapa pun.</p>
<h2>🌬️ Membaca cuaca seperti warga lokal</h2>
<p>Kalau langit abu-abu rata yang berarti hujan dua puluh menit lagi, rak jemuran harus masuk. Hujan di Hong Kong tidak datang perlahan; datang sekaligus, dan kemeja majikan Anda ada di sana.</p>
<h2>😄 Sejujurnya</h2>
<p>Rak jendela itu seni. Gantung satu handuk berat di sisi luar dan seluruh rak jadi layar. Tidak ada yang memperingatkan, semua orang pernah, dan handuknya baik-baik saja.</p>`,
  },

  {
    slug: 'cantonese-household-cleaning-words',
    channel: 'work-household',
    icon: '🧹',
    status: 'published',
    published_at: '2026-11-02T14:00:00.000Z',
    title_en: 'Cleaning Words: Sweep, Mop, Wipe, Scrub',
    title_fil: 'Mga Salita sa Paglilinis: Walis, Mop, Punas, Kuskos',
    title_zh: '清洁动词：扫、拖、抹、擦',
    title_id: 'Kata Kerja Bersih-bersih: Sapu, Pel, Lap, Gosok',
    summary_en:
      'One verb gets you most of the way. Four more get you the rest, and stop you mopping a floor you were meant to sweep.',
    summary_fil:
      'Isang pandiwa ang makakasalba sa karamihan. Apat pa ang bahala sa natitira, at pipigilan kang i-mop ang sahig na dapat walisin.',
    summary_zh: '一个动词就能应付大半。再加四个，剩下的也够了——而且不会把该扫的地拖了。',
    summary_id:
      'Satu kata kerja membawa Anda hampir seluruh jalan. Empat lagi menyelesaikannya, dan mencegah Anda mengepel lantai yang seharusnya disapu.',
    body_en: `<p>Cleaning instructions arrive as verbs, at speed, often while the person is already walking away. The good news: they are short, and they repeat every single day.</p>
<h2>🧹 The verbs</h2>
<ul>
<li><strong>掃地</strong> <em>sou2 dei6</em> — sweep the floor</li>
<li><strong>拖地</strong> <em>to1 dei6</em> — mop the floor</li>
<li><strong>抹</strong> <em>maat3</em> — wipe</li>
<li><strong>擦</strong> <em>caat3</em> — scrub</li>
<li><strong>洗</strong> <em>sai2</em> — wash</li>
<li><strong>乾淨</strong> <em>gon1 zeng6</em> — clean</li>
<li><strong>污糟</strong> <em>wu1 zou1</em> — dirty</li>
</ul>
<h2>💡 Learn one, use it all day</h2>
<p><strong>抹</strong> <em>maat3</em> is the workhorse. 抹枱 (wipe the table), 抹窗 (wipe the window), 抹地 (wipe the floor), 抹塵 (wipe the dust). Master this one verb and you can be given half the household's jobs and understand all of them.</p>
<h2>🤔 When you are not sure which one</h2>
<p>Hold up the broom and the mop and let her point. Nobody in the history of Hong Kong has been scolded for this. It is faster than guessing, and it costs nothing.</p>
<h2>😄 The honest truth</h2>
<p>掃 and 拖 sound nothing alike, but both mean "do something to the floor" and both will be said to you at the same speed, from the next room. The first week is confusing. The second week it clicks, and then you will wonder why it ever did not.</p>`,
    body_fil: `<p>Dumarating ang mga utos sa paglilinis bilang pandiwa, mabilis, madalas habang palayo na ang nagsabi. Mabuti na lang: maikli sila, at inuulit araw-araw.</p>
<h2>🧹 Ang mga pandiwa</h2>
<ul>
<li><strong>掃地</strong> <em>sou2 dei6</em> — magwalis</li>
<li><strong>拖地</strong> <em>to1 dei6</em> — mag-mop</li>
<li><strong>抹</strong> <em>maat3</em> — magpunas</li>
<li><strong>擦</strong> <em>caat3</em> — magkuskos</li>
<li><strong>洗</strong> <em>sai2</em> — maghugas</li>
<li><strong>乾淨</strong> <em>gon1 zeng6</em> — malinis</li>
<li><strong>污糟</strong> <em>wu1 zou1</em> — marumi</li>
</ul>
<h2>💡 Isang pandiwa, buong araw na gamit</h2>
<p>Ang <strong>抹</strong> <em>maat3</em> ang pinakamabisang gamit. 抹枱 (punasan ang mesa), 抹窗 (punasan ang bintana), 抹地 (punasan ang sahig), 抹塵 (punasan ang alikabok). Kapag ito lang ang gamay mo, kalahati ng gawaing bahay ay maiintindihan mo.</p>
<h2>🤔 Kapag hindi ka sigurado</h2>
<p>Itaas ang walis at mop at hayaang tumuro siya. Wala pang nasaway sa kasaysayan ng Hong Kong dahil dito. Mas mabilis kaysa manghula, at walang gastos.</p>
<h2>😄 Ang totoo</h2>
<p>Magkaiba ang tunog ng 掃 at 拖, pero pareho silang "gumawa ng kung ano sa sahig" at parehong sasabihin sa iyo sa bilis na iyon, mula sa kabilang kwarto. Magulo ang unang linggo. Sa ikalawa, kumakapit na — at magtataka ka kung bakit hindi pa ito dati klaro.</p>`,
    body_zh: `<p>清洁指令都是以动词出现的，说得很快，而且常常是对方一边走开一边说的。好消息是：它们都很短，而且每天都重复。</p>
<h2>🧹 这些动词</h2>
<ul>
<li><strong>掃地</strong> <em>sou2 dei6</em>——扫地</li>
<li><strong>拖地</strong> <em>to1 dei6</em>——拖地</li>
<li><strong>抹</strong> <em>maat3</em>——擦、抹</li>
<li><strong>擦</strong> <em>caat3</em>——刷、搓</li>
<li><strong>洗</strong> <em>sai2</em>——洗</li>
<li><strong>乾淨</strong> <em>gon1 zeng6</em>——干净</li>
<li><strong>污糟</strong> <em>wu1 zou1</em>——脏</li>
</ul>
<h2>💡 学会一个，用一整天</h2>
<p><strong>抹</strong> <em>maat3</em> 是最能干的。抹枱（擦桌子）、抹窗（擦窗）、抹地（擦地）、抹塵（擦灰）。掌握这一个，家里一半的活你都能听懂。</p>
<h2>🤔 不确定是哪一个的时候</h2>
<p>把扫帚和拖把举起来，让她指。香港历史上没有人为这个被骂过。比猜快，而且不要钱。</p>
<h2>😄 实话</h2>
<p>掃和拖听起来完全不像，但都表示「对地板做点什么」，而且都会用同样的速度、从隔壁房间说给你听。第一周很混乱。第二周就通了，然后你会奇怪为什么之前不通。</p>`,
    body_id: `<p>Perintah bersih-bersih datang sebagai kata kerja, cepat, sering sambil orangnya sudah berjalan pergi. Kabar baiknya: semuanya pendek, dan berulang setiap hari.</p>
<h2>🧹 Kata kerjanya</h2>
<ul>
<li><strong>掃地</strong> <em>sou2 dei6</em> — menyapu lantai</li>
<li><strong>拖地</strong> <em>to1 dei6</em> — mengepel</li>
<li><strong>抹</strong> <em>maat3</em> — mengelap</li>
<li><strong>擦</strong> <em>caat3</em> — menggosok</li>
<li><strong>洗</strong> <em>sai2</em> — mencuci</li>
<li><strong>乾淨</strong> <em>gon1 zeng6</em> — bersih</li>
<li><strong>污糟</strong> <em>wu1 zou1</em> — kotor</li>
</ul>
<h2>💡 Satu kata kerja, sepanjang hari</h2>
<p><strong>抹</strong> <em>maat3</em> adalah pekerja kerasnya. 抹枱 (lap meja), 抹窗 (lap jendela), 抹地 (lap lantai), 抹塵 (lap debu). Kuasai satu ini dan separuh pekerjaan rumah bisa Anda pahami.</p>
<h2>🤔 Kalau tidak yakin yang mana</h2>
<p>Angkat sapu dan pel, biarkan dia menunjuk. Belum pernah ada orang di Hong Kong dimarahi karena ini. Lebih cepat daripada menebak, dan gratis.</p>
<h2>😄 Sejujurnya</h2>
<p>掃 dan 拖 terdengar sangat berbeda, tapi keduanya berarti "lakukan sesuatu pada lantai" dan keduanya diucapkan dengan kecepatan itu, dari ruangan sebelah. Minggu pertama membingungkan. Minggu kedua klik — dan Anda akan heran kenapa sebelumnya tidak.</p>`,
  },

  {
    slug: 'cantonese-household-kitchen',
    channel: 'work-household',
    icon: '🍳',
    status: 'published',
    published_at: '2026-11-02T15:00:00.000Z',
    title_en: 'In the Kitchen: Boil, Steam, Fry, and “Not Too Salty”',
    title_fil: 'Sa Kusina: Pakuluan, Singaw, Pritong, at “Huwag Masyadong Maalat”',
    title_zh: '厨房里：煲、蒸、炒、煎，还有「不要太咸」',
    title_id: 'Di Dapur: Rebus, Kukus, Tumis, Goreng, dan “Jangan Terlalu Asin”',
    summary_en:
      'Cantonese cooking instructions are a verb plus a heat level. Get those two and dinner arrives on time.',
    summary_fil:
      'Ang utos sa pagluluto ay pandiwa at antas ng apoy. Kapag nakuha mo ang dalawa, dadating ang hapunan sa oras.',
    summary_zh: '粤菜的指令就是一个动词加一个火候。抓住这两样，晚饭就能准时上桌。',
    summary_id:
      'Perintah memasak Kanton adalah kata kerja plus tingkat api. Kuasai keduanya dan makan malam datang tepat waktu.',
    body_en: `<p>A Hong Kong kitchen is fast, hot and loud. Instructions come as one verb and one heat level, and if you catch both, the dish works. Miss the heat and you can do everything else right and still burn it.</p>
<h2>🍳 The five methods</h2>
<ul>
<li><strong>煲</strong> <em>bou1</em> — boil, usually soup, usually for hours</li>
<li><strong>蒸</strong> <em>zing1</em> — steam</li>
<li><strong>炒</strong> <em>caau2</em> — stir-fry</li>
<li><strong>煎</strong> <em>zin1</em> — pan-fry</li>
<li><strong>炸</strong> <em>zaa3</em> — deep-fry</li>
</ul>
<h2>🔥 The heat, and the word that matters most</h2>
<ul>
<li><strong>大火</strong> <em>daai6 fo2</em> — high heat &nbsp;·&nbsp; <strong>細火</strong> <em>sai3 fo2</em> — low heat</li>
<li><strong>熟</strong> <em>suk6</em> — cooked through. <strong>熟未呀？</strong> <em>suk6 mei6 aa3</em> — "Is it done?" Ask this and you will never serve raw chicken.</li>
<li><strong>唔好太鹹</strong> <em>m4 hou2 taai3 haam4</em> — "not too salty"</li>
</ul>
<h2>💡 The most dangerous word in the kitchen</h2>
<p><strong>少少</strong> <em>siu2 siu2</em> — "a little" — means anything from a pinch to half a jar, depending on who is saying it. When in doubt use less. You can always add salt; you cannot take it out.</p>
<h2>😄 The honest truth</h2>
<p>Soup here is not a quick thing. 煲湯 can take three hours and nobody considers that long. If you are told to 煲湯 at 2pm, dinner is at 7, and the pot is not to be rushed, stirred constantly, or covered with a lid you were not told about.</p>`,
    body_fil: `<p>Mabilis, mainit at maingay ang kusina sa Hong Kong. Isang pandiwa at isang antas ng apoy ang utos, at kapag nakuha mo pareho, ayos ang putahe. Kapag namalikmata ka sa apoy, maaaring tama lahat ng iba at nasunog pa rin.</p>
<h2>🍳 Ang limang paraan</h2>
<ul>
<li><strong>煲</strong> <em>bou1</em> — pakuluan, kadalasan sabaw, kadalasan ilang oras</li>
<li><strong>蒸</strong> <em>zing1</em> — singawin</li>
<li><strong>炒</strong> <em>caau2</em> — igisa</li>
<li><strong>煎</strong> <em>zin1</em> — prituhin sa kawali</li>
<li><strong>炸</strong> <em>zaa3</em> — i-deep fry</li>
</ul>
<h2>🔥 Ang apoy, at ang pinakamahalagang salita</h2>
<ul>
<li><strong>大火</strong> <em>daai6 fo2</em> — malakas na apoy &nbsp;·&nbsp; <strong>細火</strong> <em>sai3 fo2</em> — mahinang apoy</li>
<li><strong>熟</strong> <em>suk6</em> — luto na. <strong>熟未呀？</strong> <em>suk6 mei6 aa3</em> — "Luto na ba?" Itanong ito at hindi ka maghahain ng hilaw na manok.</li>
<li><strong>唔好太鹹</strong> <em>m4 hou2 taai3 haam4</em> — "huwag masyadong maalat"</li>
</ul>
<h2>💡 Ang pinakamapanganib na salita sa kusina</h2>
<p>Ang <strong>少少</strong> <em>siu2 siu2</em> — "kaunti" — ay mula sa isang kurot hanggang kalahating garapon, depende sa nagsasabi. Kapag hindi sigurado, bawasan. Laging pwedeng magdagdag ng asin; hindi na maaalis.</p>
<h2>😄 Ang totoo</h2>
<p>Ang sabaw dito ay hindi mabilisang bagay. Ang 煲湯 ay tatlong oras at walang nag-iisip na mahaba iyon. Kapag sinabihang 煲湯 nang 2pm, hapunan sa 7, at ang kaldero ay hindi minamadali, hindi hinahalo nang tuloy-tuloy, at hindi tinatakpan ng takip na hindi sinabi sa iyo.</p>`,
    body_zh: `<p>香港的厨房又快、又热、又吵。指令就是一个动词加一个火候，两样都抓住了，菜就成。火候没听清，别的全对，还是能烧焦。</p>
<h2>🍳 五种做法</h2>
<ul>
<li><strong>煲</strong> <em>bou1</em>——煲，通常是汤，通常好几个小时</li>
<li><strong>蒸</strong> <em>zing1</em>——蒸</li>
<li><strong>炒</strong> <em>caau2</em>——炒</li>
<li><strong>煎</strong> <em>zin1</em>——煎</li>
<li><strong>炸</strong> <em>zaa3</em>——炸</li>
</ul>
<h2>🔥 火候，还有最重要的那个词</h2>
<ul>
<li><strong>大火</strong> <em>daai6 fo2</em>——大火 &nbsp;·&nbsp; <strong>細火</strong> <em>sai3 fo2</em>——小火</li>
<li><strong>熟</strong> <em>suk6</em>——熟了。<strong>熟未呀？</strong> <em>suk6 mei6 aa3</em>——「熟了没有？」问了这句，你永远不会端上生鸡肉。</li>
<li><strong>唔好太鹹</strong> <em>m4 hou2 taai3 haam4</em>——「不要太咸」</li>
</ul>
<h2>💡 厨房里最危险的词</h2>
<p><strong>少少</strong> <em>siu2 siu2</em>——「一点点」——可以是一撮，也可以是半罐，看是谁在说。不确定就少放。盐可以再加，加多了拿不出来。</p>
<h2>😄 实话</h2>
<p>这里的汤不是快手菜。煲汤可以煲三个小时，没人觉得久。如果下午两点叫你煲汤，晚饭是七点，那锅汤不能催、不能一直搅、也不能盖上没人让你盖的盖。</p>`,
    body_id: `<p>Dapur Hong Kong itu cepat, panas, dan berisik. Perintah datang sebagai satu kata kerja dan satu tingkat api, dan kalau keduanya tertangkap, masakannya jadi. Lewatkan apinya dan semua yang lain bisa benar tapi tetap gosong.</p>
<h2>🍳 Lima metode</h2>
<ul>
<li><strong>煲</strong> <em>bou1</em> — merebus, biasanya sup, biasanya berjam-jam</li>
<li><strong>蒸</strong> <em>zing1</em> — mengukus</li>
<li><strong>炒</strong> <em>caau2</em> — menumis</li>
<li><strong>煎</strong> <em>zin1</em> — menggoreng di wajan</li>
<li><strong>炸</strong> <em>zaa3</em> — menggoreng deep fry</li>
</ul>
<h2>🔥 Api, dan kata yang paling penting</h2>
<ul>
<li><strong>大火</strong> <em>daai6 fo2</em> — api besar &nbsp;·&nbsp; <strong>細火</strong> <em>sai3 fo2</em> — api kecil</li>
<li><strong>熟</strong> <em>suk6</em> — matang. <strong>熟未呀？</strong> <em>suk6 mei6 aa3</em> — "Sudah matang?" Tanyakan ini dan Anda tidak akan pernah menyajikan ayam mentah.</li>
<li><strong>唔好太鹹</strong> <em>m4 hou2 taai3 haam4</em> — "jangan terlalu asin"</li>
</ul>
<h2>💡 Kata paling berbahaya di dapur</h2>
<p><strong>少少</strong> <em>siu2 siu2</em> — "sedikit" — berarti dari sejumput sampai setengah toples, tergantung siapa yang bicara. Kalau ragu, kurangi. Garam selalu bisa ditambah; tidak bisa diambil.</p>
<h2>😄 Sejujurnya</h2>
<p>Sup di sini bukan hal cepat. 煲湯 bisa tiga jam dan tidak ada yang menganggapnya lama. Kalau disuruh 煲湯 jam 2 siang, makan malam jam 7, dan panci itu tidak boleh diburu-buru, diaduk terus, atau ditutup dengan tutup yang tidak diminta.</p>`,
  },

  {
    slug: 'cantonese-household-say-it-slower',
    channel: 'work-household',
    icon: '🤔',
    status: 'published',
    published_at: '2026-11-02T16:00:00.000Z',
    title_en: 'When You Did Not Understand: Three Polite Ways to Ask Again',
    title_fil: 'Kapag Hindi Mo Naintindihan: Tatlong Magalang na Paraan ng Pagtatanong Muli',
    title_zh: '没听懂的时候：三种礼貌地再问一次',
    title_id: 'Saat Tidak Paham: Tiga Cara Sopan untuk Bertanya Lagi',
    summary_en:
      'Nodding and hoping is how mistakes happen. These three sentences buy you time without losing face.',
    summary_fil:
      'Ang pagtango at pag-asa ang pinagmumulan ng mali. Tatlong pangungusap ang magbibigay ng oras nang hindi nawawala ang dangal.',
    summary_zh: '点头加祈祷，就是错误的来源。这三句话能给你时间，又不必丢脸。',
    summary_id:
      'Mengangguk sambil berharap adalah asal kesalahan. Tiga kalimat ini membeli waktu tanpa kehilangan muka.',
    body_en: `<p>This is the most important post in the whole channel, and it contains no vocabulary about markets or mopping. It is about the one habit that separates a hard first month from a disastrous one.</p>
<h2>🙅 The expensive sentence</h2>
<p>"Yes yes yes" with a smile is the most costly thing you can say in Hong Kong. It costs one broken plate, one shirt that is now pink, one medicine given at the wrong time. It feels polite. It is not — it is a promise you cannot keep.</p>
<h2>🤔 Three sentences that fix it</h2>
<ul>
<li><strong>唔好意思，我聽唔清楚</strong> <em>m4 hou2 ji3 si1, ngo5 teng1 m4 cing1 co2</em> — "Sorry, I did not hear clearly."</li>
<li><strong>可唔可以講慢啲？</strong> <em>ho2 m4 ho2 ji5 gong2 maan6 di1</em> — "Could you speak a little slower?"</li>
<li><strong>呢個點做？</strong> <em>ni1 go3 dim2 zou6</em> — "How do I do this?"</li>
</ul>
<h2>💡 The move that proves you listened</h2>
<p>Repeat the instruction back in your own words: <strong>即係…</strong> <em>zik1 hai6</em> — "so that means…" Then let her correct you. It is faster than asking twice, it shows you are paying attention, and it turns a possible mistake into a shared joke.</p>
<h2>😄 The honest truth</h2>
<p>Every helper who has been in Hong Kong five years has said 唔好意思 ten thousand times. Nobody remembers the asking. Everybody remembers the thing that broke. Ask.</p>`,
    body_fil: `<p>Ito ang pinakamahalagang post sa buong channel, at wala itong bokabularyo tungkol sa palengke o mop. Ito ay tungkol sa isang ugali na naghihiwalay ng mahirap na unang buwan sa isang sakuna.</p>
<h2>🙅 Ang mamahaling pangungusap</h2>
<p>Ang "oo oo oo" na may ngiti ang pinakamahal na masasabi mo sa Hong Kong. Katumbas ito ng isang basag na plato, isang kamisetang kulay-rosas na ngayon, isang gamot na naibigay sa maling oras. Mukhang magalang. Hindi — pangako itong hindi mo kayang tuparin.</p>
<h2>🤔 Tatlong pangungusap na aayos nito</h2>
<ul>
<li><strong>唔好意思，我聽唔清楚</strong> <em>m4 hou2 ji3 si1, ngo5 teng1 m4 cing1 co2</em> — "Pasensya, hindi ko narinig nang malinaw."</li>
<li><strong>可唔可以講慢啲？</strong> <em>ho2 m4 ho2 ji5 gong2 maan6 di1</em> — "Pwede bang dahan-dahan?"</li>
<li><strong>呢個點做？</strong> <em>ni1 go3 dim2 zou6</em> — "Paano ito gawin?"</li>
</ul>
<h2>💡 Ang galaw na nagpapatunay na nakinig ka</h2>
<p>Ulitin ang utos sa sariling salita: <strong>即係…</strong> <em>zik1 hai6</em> — "ibig sabihin…" Tapos hayaang itama ka niya. Mas mabilis kaysa magtanong nang dalawang beses, nagpapakita kang nakikinig, at ginagawang biro ang posibleng pagkakamali.</p>
<h2>😄 Ang totoo</h2>
<p>Bawat helper na limang taon nang nasa Hong Kong ay nakapagsabi ng 唔好意思 nang sampung libong beses. Walang nakakaalala sa pagtatanong. Lahat naaalala ang nabasag. Magtanong.</p>`,
    body_zh: `<p>这是整个频道里最重要的一篇，里面没有一个关于街市或拖地的词。它讲的是一个习惯——把「难熬的第一个月」和「灾难性的第一个月」分开的那个习惯。</p>
<h2>🙅 最贵的一句话</h2>
<p>笑着说「是是是」，是你在香港能说出的最贵的话。代价是一个摔碎的盘子、一件变成粉色的衬衫、一次喂错时间的药。它看起来很礼貌。其实不是——那是一个你守不住的承诺。</p>
<h2>🤔 三句话解决</h2>
<ul>
<li><strong>唔好意思，我聽唔清楚</strong> <em>m4 hou2 ji3 si1, ngo5 teng1 m4 cing1 co2</em>——「不好意思，我没听清楚。」</li>
<li><strong>可唔可以講慢啲？</strong> <em>ho2 m4 ho2 ji5 gong2 maan6 di1</em>——「可以说慢一点吗？」</li>
<li><strong>呢個點做？</strong> <em>ni1 go3 dim2 zou6</em>——「这个怎么做？」</li>
</ul>
<h2>💡 证明你在听的那一步</h2>
<p>用自己的话把指令复述一遍：<strong>即係…</strong> <em>zik1 hai6</em>——「也就是说……」然后让她纠正你。这比问两次快，能说明你在认真听，还能把一个可能的错误变成两个人一起笑的事。</p>
<h2>😄 实话</h2>
<p>每一个在香港待了五年的家佣，都说过一万次「唔好意思」。没有人记得你问过。所有人都记得碎掉的那个。问吧。</p>`,
    body_id: `<p>Ini postingan terpenting di seluruh kanal ini, dan tidak ada satu pun kosakata tentang pasar atau mengepel. Ini tentang satu kebiasaan yang memisahkan bulan pertama yang berat dari bulan pertama yang berantakan.</p>
<h2>🙅 Kalimat yang mahal</h2>
<p>"Iya iya iya" sambil tersenyum adalah hal termahal yang bisa Anda ucapkan di Hong Kong. Harganya satu piring pecah, satu kemeja yang kini berwarna merah muda, satu obat yang diberikan di waktu yang salah. Terdengar sopan. Tidak — itu janji yang tidak bisa Anda tepati.</p>
<h2>🤔 Tiga kalimat yang memperbaikinya</h2>
<ul>
<li><strong>唔好意思，我聽唔清楚</strong> <em>m4 hou2 ji3 si1, ngo5 teng1 m4 cing1 co2</em> — "Maaf, saya tidak mendengar jelas."</li>
<li><strong>可唔可以講慢啲？</strong> <em>ho2 m4 ho2 ji5 gong2 maan6 di1</em> — "Bisa bicara lebih lambat?"</li>
<li><strong>呢個點做？</strong> <em>ni1 go3 dim2 zou6</em> — "Bagaimana melakukan ini?"</li>
</ul>
<h2>💡 Gerakan yang membuktikan Anda mendengar</h2>
<p>Ulangi perintahnya dengan kata-kata sendiri: <strong>即係…</strong> <em>zik1 hai6</em> — "jadi artinya…" Lalu biarkan dia mengoreksi. Lebih cepat daripada bertanya dua kali, menunjukkan Anda memperhatikan, dan mengubah kemungkinan kesalahan jadi lelucon bersama.</p>
<h2>😄 Sejujurnya</h2>
<p>Setiap asisten yang sudah lima tahun di Hong Kong pernah mengucapkan 唔好意思 sepuluh ribu kali. Tidak ada yang mengingat pertanyaannya. Semua orang mengingat yang pecah. Bertanyalah.</p>`,
  },

  // =========================================================================
  // HEALTH
  // =========================================================================
  {
    slug: 'cantonese-health-where-does-it-hurt',
    channel: 'health',
    icon: '🩺',
    status: 'published',
    published_at: '2026-11-02T17:00:00.000Z',
    title_en: 'Where Does It Hurt? Describing Pain in Cantonese',
    title_fil: 'Saan ang Masakit? Paglalarawan ng Sakit sa Cantonese',
    title_zh: '哪里痛？用粤语说清楚疼痛',
    title_id: 'Di Mana Sakitnya? Menjelaskan Nyeri dalam Bahasa Kanton',
    summary_en:
      'A doctor has three minutes. “It hurts” wastes two of them. Point, then say which kind of hurt.',
    summary_fil:
      'Tatlong minuto ang doktor. Ang “masakit” ay sayang ang dalawa. Ituro, tapos sabihin kung anong klaseng sakit.',
    summary_zh: '医生只有三分钟。「很痛」浪费掉两分钟。先指位置，再说哪种痛。',
    summary_id:
      'Dokter punya tiga menit. "Sakit" membuang dua di antaranya. Tunjuk dulu, lalu sebutkan jenis sakitnya.',
    body_en: `<p>A Hong Kong public clinic consultation is short — often three minutes, because the queue outside is two hours long. That is not unkindness, it is arithmetic. The patients who get good care are the ones who arrive with the information already organised.</p>
<h2>🩺 The words for where</h2>
<ul>
<li><strong>痛</strong> <em>tung3</em> — pain, to hurt</li>
<li><strong>頭痛</strong> <em>tau4 tung3</em> — headache</li>
<li><strong>肚痛</strong> <em>tou5 tung3</em> — stomach ache</li>
<li><strong>喉嚨痛</strong> <em>hau4 lung4 tung3</em> — sore throat</li>
<li><strong>呢度痛</strong> <em>ni1 dou6 tung3</em> — "It hurts here" — point while you say it</li>
</ul>
<h2>🩹 The words for how much</h2>
<ul>
<li><strong>好痛</strong> <em>hou2 tung3</em> — very painful</li>
<li><strong>少少痛</strong> <em>siu2 siu2 tung3</em> — a little painful</li>
<li><strong>痺</strong> <em>bei3</em> — numb, tingling</li>
<li><strong>三日</strong> <em>saam1 jat6</em> — three days (how long it has been going on)</li>
</ul>
<h2>💡 The four facts that get you treated properly</h2>
<p>Where it hurts. How long. How bad, from one to ten. What makes it worse. Write these four in Chinese on your phone before you go, and show the screen. Nobody will think less of you — you will simply be seen faster and treated better.</p>
<h2>😄 The honest truth</h2>
<p>You will be tempted to say <strong>冇事</strong> <em>mou5 si6</em> — "it is nothing" — because you do not want to be a bother or miss a day's pay. Do not. A sore throat that is still there in a week is not nothing, and the clinic is cheaper than the hospital.</p>`,
    body_fil: `<p>Maikli ang konsultasyon sa public clinic sa Hong Kong — tatlong minuto, dahil dalawang oras ang pila sa labas. Hindi iyon kabastusan, aritmetika iyon. Ang mga pasyenteng maayos ang pag-aalaga ay iyong dumarating na organisado na ang impormasyon.</p>
<h2>🩺 Mga salita para sa saan</h2>
<ul>
<li><strong>痛</strong> <em>tung3</em> — masakit</li>
<li><strong>頭痛</strong> <em>tau4 tung3</em> — sakit ng ulo</li>
<li><strong>肚痛</strong> <em>tou5 tung3</em> — sakit ng tiyan</li>
<li><strong>喉嚨痛</strong> <em>hau4 lung4 tung3</em> — namamagang lalamunan</li>
<li><strong>呢度痛</strong> <em>ni1 dou6 tung3</em> — "Masakit dito" — ituro habang sinasabi</li>
</ul>
<h2>🩹 Mga salita para sa gaano</h2>
<ul>
<li><strong>好痛</strong> <em>hou2 tung3</em> — sobrang sakit</li>
<li><strong>少少痛</strong> <em>siu2 siu3 tung3</em> — medyo masakit</li>
<li><strong>痺</strong> <em>bei3</em> — manhid, nginig</li>
<li><strong>三日</strong> <em>saam1 jat6</em> — tatlong araw (gaano na katagal)</li>
</ul>
<h2>💡 Ang apat na impormasyong magpapagamot nang tama</h2>
<p>Saan masakit. Gaano katagal. Gaano kalala, isa hanggang sampu. Ano ang nagpapalala. Isulat ang apat na ito sa Chinese sa telepono bago pumunta, at ipakita ang screen. Walang magmamaliit sa iyo — mas mabilis ka lang makikita at mas maayos ang gamot.</p>
<h2>😄 Ang totoo</h2>
<p>Matutukso kang sabihing <strong>冇事</strong> <em>mou5 si6</em> — "wala ito" — dahil ayaw mong maging abala o mawalan ng kita. Huwag. Ang namamagang lalamunan na isang linggo pa ay hindi "wala", at mas mura ang clinic kaysa ospital.</p>`,
    body_zh: `<p>香港公立诊所的诊症很短——常常三分钟，因为外面排着两个小时的队。那不是冷漠，是算数。得到好照顾的病人，都是把资料先整理好才来的。</p>
<h2>🩺 说「哪里」的词</h2>
<ul>
<li><strong>痛</strong> <em>tung3</em>——痛</li>
<li><strong>頭痛</strong> <em>tau4 tung3</em>——头痛</li>
<li><strong>肚痛</strong> <em>tou5 tung3</em>——肚子痛</li>
<li><strong>喉嚨痛</strong> <em>hau4 lung4 tung3</em>——喉咙痛</li>
<li><strong>呢度痛</strong> <em>ni1 dou6 tung3</em>——「这里痛」——说的时候指着</li>
</ul>
<h2>🩹 说「多痛」的词</h2>
<ul>
<li><strong>好痛</strong> <em>hou2 tung3</em>——很痛</li>
<li><strong>少少痛</strong> <em>siu2 siu2 tung3</em>——有点痛</li>
<li><strong>痺</strong> <em>bei3</em>——麻</li>
<li><strong>三日</strong> <em>saam1 jat6</em>——三天（痛了多久）</li>
</ul>
<h2>💡 让你被好好治疗的四个信息</h2>
<p>哪里痛。痛了多久。有多痛，一到十。什么会让它更痛。去看医生前把这四样用中文写在手机里，把屏幕给他看。没人会看轻你——你只会更快被看到、得到更好的治疗。</p>
<h2>😄 实话</h2>
<p>你会有冲动说<strong>冇事</strong> <em>mou5 si6</em>——「没事」——因为你不想添麻烦，也不想少一天工钱。别说。一个星期还没好的喉咙痛不是「没事」，而诊所比医院便宜。</p>`,
    body_id: `<p>Konsultasi di klinik publik Hong Kong itu singkat — sering tiga menit, karena antrean di luar dua jam. Itu bukan kekasaran, itu aritmetika. Pasien yang mendapat perawatan baik adalah yang datang dengan informasi sudah tertata.</p>
<h2>🩺 Kata untuk "di mana"</h2>
<ul>
<li><strong>痛</strong> <em>tung3</em> — sakit</li>
<li><strong>頭痛</strong> <em>tau4 tung3</em> — sakit kepala</li>
<li><strong>肚痛</strong> <em>tou5 tung3</em> — sakit perut</li>
<li><strong>喉嚨痛</strong> <em>hau4 lung4 tung3</em> — sakit tenggorokan</li>
<li><strong>呢度痛</strong> <em>ni1 dou6 tung3</em> — "Sakit di sini" — tunjuk sambil bicara</li>
</ul>
<h2>🩹 Kata untuk "seberapa"</h2>
<ul>
<li><strong>好痛</strong> <em>hou2 tung3</em> — sangat sakit</li>
<li><strong>少少痛</strong> <em>siu2 siu2 tung3</em> — sedikit sakit</li>
<li><strong>痺</strong> <em>bei3</em> — kebas, kesemutan</li>
<li><strong>三日</strong> <em>saam1 jat6</em> — tiga hari (sudah berapa lama)</li>
</ul>
<h2>💡 Empat fakta yang membuat Anda ditangani dengan benar</h2>
<p>Di mana sakitnya. Sudah berapa lama. Seberapa parah, satu sampai sepuluh. Apa yang memperburuk. Tulis keempatnya dalam bahasa Mandarin di ponsel sebelum pergi, dan tunjukkan layarnya. Tidak ada yang akan meremehkan Anda — Anda hanya akan lebih cepat ditangani dan lebih baik dirawat.</p>
<h2>😄 Sejujurnya</h2>
<p>Anda akan tergoda bilang <strong>冇事</strong> <em>mou5 si6</em> — "tidak apa-apa" — karena tidak ingin merepotkan atau kehilangan upah sehari. Jangan. Sakit tenggorokan yang masih ada seminggu kemudian bukan "tidak apa-apa", dan klinik lebih murah daripada rumah sakit.</p>`,
  },

  {
    slug: 'cantonese-health-pharmacy-medicine',
    channel: 'health',
    icon: '💊',
    status: 'published',
    published_at: '2026-11-02T18:00:00.000Z',
    title_en: 'At the Pharmacy: Medicine, Dosage and “Will It Make Me Sleepy?”',
    title_fil: 'Sa Botika: Gamot, Dosis at “Aantukin Ba Ako?”',
    title_zh: '药房：买药、剂量，还有「会不会想睡？」',
    title_id: 'Di Apotek: Obat, Dosis, dan “Apakah Membuat Ngantuk?”',
    summary_en:
      'The pharmacy is faster than the clinic for small things. Five phrases and you will leave with the right box.',
    summary_fil:
      'Mas mabilis ang botika kaysa clinic sa maliliit na bagay. Limang parirala at tama ang kahon na mabibili mo.',
    summary_zh: '小毛病去药房比去诊所快。五句话，你就不会买错那盒。',
    summary_id:
      'Apotek lebih cepat daripada klinik untuk hal kecil. Lima frasa dan Anda pulang dengan kotak yang tepat.',
    body_en: `<p>For a cold, a cough or a headache, the pharmacy is faster and cheaper than the clinic. The trick is asking two questions before you pay, because half the cold remedies here will put you to sleep.</p>
<h2>💊 The phrases</h2>
<ul>
<li><strong>藥房</strong> <em>joek6 fong2</em> — pharmacy</li>
<li><strong>我買藥</strong> <em>ngo5 maai5 joek6</em> — "I want to buy medicine"</li>
<li><strong>一日幾次？</strong> <em>jat1 jat6 gei2 ci3</em> — "How many times a day?"</li>
<li><strong>一次幾粒？</strong> <em>jat1 ci3 gei2 lap1</em> — "How many pills at a time?"</li>
<li><strong>會唔會眼睏？</strong> <em>wui5 m4 wui5 ngaan5 kwan3</em> — "Will it make me sleepy?"</li>
</ul>
<h2>💡 The question that saves your working day</h2>
<p><strong>會唔會眼睏？</strong> Many cold and allergy medicines here contain an antihistamine that will have you drowsy by mid-morning. If the answer is yes and you are working, ask for <strong>唔眼睏</strong> <em>m4 ngaan5 kwan3</em> — the non-drowsy one. It exists and it costs the same.</p>
<h2>🩹 One more, for safety</h2>
<p><strong>我對…敏感</strong> <em>ngo5 deoi3 … man5 gam2</em> — "I am allergic to…" Say it before you take anything, every time. If you have an allergy, write it in Chinese and keep it on your phone.</p>
<h2>😄 The honest truth</h2>
<p>The pharmacist will put three boxes on the counter and recommend the middle one. Take the middle one. This is not a scam — it is the local algorithm, and it works. They have done this ten thousand times and you have done it none.</p>`,
    body_fil: `<p>Para sa sipon, ubo o sakit ng ulo, mas mabilis at mas mura ang botika kaysa clinic. Ang sikreto: magtanong ng dalawang bagay bago magbayad, dahil kalahati ng gamot sa sipon dito ay nagpapaantok.</p>
<h2>💊 Ang mga parirala</h2>
<ul>
<li><strong>藥房</strong> <em>joek6 fong2</em> — botika</li>
<li><strong>我買藥</strong> <em>ngo5 maai5 joek6</em> — "Bibili ako ng gamot"</li>
<li><strong>一日幾次？</strong> <em>jat1 jat6 gei2 ci3</em> — "Ilang beses sa isang araw?"</li>
<li><strong>一次幾粒？</strong> <em>jat1 ci3 gei2 lap1</em> — "Ilang tableta bawat beses?"</li>
<li><strong>會唔會眼睏？</strong> <em>wui5 m4 wui5 ngaan5 kwan3</em> — "Aantukin ba ako?"</li>
</ul>
<h2>💡 Ang tanong na magliligtas sa araw ng trabaho mo</h2>
<p><strong>會唔會眼睏？</strong> Marami sa gamot sa sipon at allergy dito ay may antihistamine na magpapaantok sa iyo bago magtanghali. Kapag oo ang sagot at nagtatrabaho ka, itanong ang <strong>唔眼睏</strong> <em>m4 ngaan5 kwan3</em> — ang hindi nagpapaantok. Mayroon nito at pareho ang presyo.</p>
<h2>🩹 Isa pa, para sa kaligtasan</h2>
<p><strong>我對…敏感</strong> <em>ngo5 deoi3 … man5 gam2</em> — "Allergic ako sa…" Sabihin bago uminom ng kahit ano, tuwing beses. Kung may allergy ka, isulat sa Chinese at itago sa telepono.</p>
<h2>😄 Ang totoo</h2>
<p>Tatlong kahon ang ilalagay ng pharmacist sa counter at irerekomenda ang nasa gitna. Kunin mo ang gitna. Hindi ito scam — lokal na algorithm ito, at gumagana. Sampung libong beses na nila itong ginawa, ikaw wala pa.</p>`,
    body_zh: `<p>感冒、咳嗽、头痛，去药房比去诊所快，也便宜。诀窍是付钱之前问两个问题——因为这里一半的感冒药会让你想睡。</p>
<h2>💊 这几句</h2>
<ul>
<li><strong>藥房</strong> <em>joek6 fong2</em>——药房</li>
<li><strong>我買藥</strong> <em>ngo5 maai5 joek6</em>——「我买药。」</li>
<li><strong>一日幾次？</strong> <em>jat1 jat6 gei2 ci3</em>——「一天几次？」</li>
<li><strong>一次幾粒？</strong> <em>jat1 ci3 gei2 lap1</em>——「一次几粒？」</li>
<li><strong>會唔會眼睏？</strong> <em>wui5 m4 wui5 ngaan5 kwan3</em>——「会不会想睡？」</li>
</ul>
<h2>💡 保住你一天工作的那个问题</h2>
<p><strong>會唔會眼睏？</strong> 这里很多感冒药和抗敏药含抗组胺，上午不到就会让你昏昏欲睡。如果答案是「会」，而你要上班，就问<strong>唔眼睏</strong> <em>m4 ngaan5 kwan3</em>——不嗜睡的那种。有这种，价钱一样。</p>
<h2>🩹 再一句，为了安全</h2>
<p><strong>我對…敏感</strong> <em>ngo5 deoi3 … man5 gam2</em>——「我对……敏感／过敏。」吃药之前每次都要说。如果你有过敏，用中文写下来，存在手机里。</p>
<h2>😄 实话</h2>
<p>药房的人会把三盒放在柜台上，然后推荐中间那盒。就买中间那盒。这不是骗人——这是本地的算法，而且管用。他们做过一万次，你一次都没做过。</p>`,
    body_id: `<p>Untuk pilek, batuk, atau sakit kepala, apotek lebih cepat dan lebih murah daripada klinik. Triknya: ajukan dua pertanyaan sebelum membayar, karena separuh obat pilek di sini membuat Anda mengantuk.</p>
<h2>💊 Frasanya</h2>
<ul>
<li><strong>藥房</strong> <em>joek6 fong2</em> — apotek</li>
<li><strong>我買藥</strong> <em>ngo5 maai5 joek6</em> — "Saya mau beli obat"</li>
<li><strong>一日幾次？</strong> <em>jat1 jat6 gei2 ci3</em> — "Berapa kali sehari?"</li>
<li><strong>一次幾粒？</strong> <em>jat1 ci3 gei2 lap1</em> — "Berapa butir sekali minum?"</li>
<li><strong>會唔會眼睏？</strong> <em>wui5 m4 wui5 ngaan5 kwan3</em> — "Apakah membuat ngantuk?"</li>
</ul>
<h2>💡 Pertanyaan yang menyelamatkan hari kerja Anda</h2>
<p><strong>會唔會眼睏？</strong> Banyak obat pilek dan alergi di sini mengandung antihistamin yang membuat Anda mengantuk sebelum tengah pagi. Kalau jawabannya ya dan Anda bekerja, minta yang <strong>唔眼睏</strong> <em>m4 ngaan5 kwan3</em> — yang tidak membuat ngantuk. Ada, harganya sama.</p>
<h2>🩹 Satu lagi, untuk keamanan</h2>
<p><strong>我對…敏感</strong> <em>ngo5 deoi3 … man5 gam2</em> — "Saya alergi terhadap…" Ucapkan sebelum minum apa pun, setiap kali. Kalau Anda punya alergi, tulis dalam bahasa Mandarin dan simpan di ponsel.</p>
<h2>😄 Sejujurnya</h2>
<p>Apoteker akan meletakkan tiga kotak di meja dan merekomendasikan yang tengah. Ambil yang tengah. Ini bukan penipuan — ini algoritma lokal, dan berhasil. Mereka sudah melakukannya sepuluh ribu kali, Anda belum pernah.</p>`,
  },

  {
    slug: 'cantonese-health-clinic-visit',
    channel: 'health',
    icon: '🏥',
    status: 'published',
    published_at: '2026-11-02T19:00:00.000Z',
    title_en: 'At the Clinic: Registering, Waiting, and Being Seen',
    title_fil: 'Sa Clinic: Pagpaparehistro, Paghihintay, at Pagpapakonsulta',
    title_zh: '在诊所：挂号、等候、看诊',
    title_id: 'Di Klinik: Mendaftar, Menunggu, dan Diperiksa',
    summary_en:
      'The hardest part of seeing a doctor in Hong Kong is the first five minutes at the counter.',
    summary_fil:
      'Ang pinakamahirap na bahagi ng pagkonsulta sa Hong Kong ay ang unang limang minuto sa counter.',
    summary_zh: '在香港看医生，最难的是在柜台前的那五分钟。',
    summary_id:
      'Bagian tersulit berobat ke dokter di Hong Kong adalah lima menit pertama di loket.',
    body_en: `<p>The doctor is not the hard part. The counter is. You arrive, there is a queue, a form, a plastic card, and a person speaking faster than the last person. Get these words and the rest is waiting.</p>
<h2>🏥 At the counter</h2>
<ul>
<li><strong>登記</strong> <em>dang1 gei2</em> — register</li>
<li><strong>睇醫生</strong> <em>tai2 ji1 sang1</em> — see a doctor</li>
<li><strong>預約</strong> <em>jyu6 joek3</em> — appointment</li>
<li><strong>身份證</strong> <em>san1 fan2 zing3</em> — identity card</li>
<li><strong>等幾耐？</strong> <em>dang2 gei2 noi6</em> — "How long is the wait?"</li>
</ul>
<h2>💡 What to bring, every time</h2>
<p>Your HKID, your employer's phone number, and cash. Many clinics do not take cards for a first visit, and a clinic that cannot reach your employer cannot treat a minor. Put all three in one pocket before you leave the flat.</p>
<h2>⏳ Reading the room</h2>
<p><strong>等一陣</strong> <em>dang2 jat1 zan6</em> means "wait a moment". In a shop that is a minute. In a clinic it is anything from ten minutes to two hours. Bring a book, a charger, and low expectations — and you will be pleasantly surprised rather than furious.</p>
<h2>😄 The honest truth</h2>
<p>Nobody enjoys the wait. But the public system here is genuinely good and genuinely cheap, and the staff are doing their best with a queue that never ends. Being pleasant at the counter is not just kind — it is the fastest way through it.</p>`,
    body_fil: `<p>Hindi ang doktor ang mahirap. Ang counter ang mahirap. Darating ka, may pila, may form, may plastik na card, at may taong mas mabilis magsalita kaysa sa nauna. Kapag nakuha mo ang mga salitang ito, paghihintay na lang ang natitira.</p>
<h2>🏥 Sa counter</h2>
<ul>
<li><strong>登記</strong> <em>dang1 gei2</em> — magparehistro</li>
<li><strong>睇醫生</strong> <em>tai2 ji1 sang1</em> — magpakonsulta</li>
<li><strong>預約</strong> <em>jyu6 joek3</em> — appointment</li>
<li><strong>身份證</strong> <em>san1 fan2 zing3</em> — ID card</li>
<li><strong>等幾耐？</strong> <em>dang2 gei2 noi6</em> — "Gaano katagal ang hintay?"</li>
</ul>
<h2>💡 Ang dalhin, tuwing beses</h2>
<p>Ang HKID mo, numero ng amo mo, at cash. Maraming clinic ang hindi tumatanggap ng card sa unang bisita, at ang clinic na hindi maabot ang amo mo ay hindi makakagamot ng menor de edad. Ilagay ang tatlo sa isang bulsa bago umalis.</p>
<h2>⏳ Pagbasa sa sitwasyon</h2>
<p>Ang <strong>等一陣</strong> <em>dang2 jat1 zan6</em> ay "maghintay sandali". Sa tindahan, isang minuto. Sa clinic, sampung minuto hanggang dalawang oras. Magdala ng libro, charger, at mababang ekspektasyon — at mabibigla ka sa saya kaysa sa galit.</p>
<h2>😄 Ang totoo</h2>
<p>Walang nag-eenjoy sa hintayan. Pero ang public system dito ay talagang maayos at talagang mura, at ginagawa ng staff ang lahat sa pilang walang katapusan. Ang pagiging mabait sa counter ay hindi lang kabaitan — ito ang pinakamabilis na daan.</p>`,
    body_zh: `<p>难的不是医生，是柜台。你到了，有队伍、有表格、有一张塑胶卡，还有一个人说话比上一个人更快。把这些词抓住，剩下的就只是等。</p>
<h2>🏥 柜台前</h2>
<ul>
<li><strong>登記</strong> <em>dang1 gei2</em>——登记、挂号</li>
<li><strong>睇醫生</strong> <em>tai2 ji1 sang1</em>——看医生</li>
<li><strong>預約</strong> <em>jyu6 joek3</em>——预约</li>
<li><strong>身份證</strong> <em>san1 fan2 zing3</em>——身份证</li>
<li><strong>等幾耐？</strong> <em>dang2 gei2 noi6</em>——「要等多久？」</li>
</ul>
<h2>💡 每次都带这三样</h2>
<p>你的香港身份证、雇主的电话号码、现金。很多诊所第一次不收卡，而联系不上雇主的诊所，不能给未成年人看病。出门前把这三样放同一个口袋。</p>
<h2>⏳ 读懂现场</h2>
<p><strong>等一陣</strong> <em>dang2 jat1 zan6</em> 是「等一下」。在店里是一分钟。在诊所是十分钟到两小时。带本书、带充电器、把期望放低——然后你会惊喜，而不是生气。</p>
<h2>😄 实话</h2>
<p>没人喜欢等。但这里的公立系统确实好，也确实便宜，而柜台的人正在应付一条永远没有尽头的队。在柜台前和善一点不只是善良——那是最快通过的方式。</p>`,
    body_id: `<p>Dokternya bukan bagian sulit. Loketnya. Anda datang, ada antrean, ada formulir, ada kartu plastik, dan ada orang yang bicara lebih cepat dari orang sebelumnya. Kuasai kata-kata ini dan sisanya hanya menunggu.</p>
<h2>🏥 Di loket</h2>
<ul>
<li><strong>登記</strong> <em>dang1 gei2</em> — mendaftar</li>
<li><strong>睇醫生</strong> <em>tai2 ji1 sang1</em> — berobat ke dokter</li>
<li><strong>預約</strong> <em>jyu6 joek3</em> — janji temu</li>
<li><strong>身份證</strong> <em>san1 fan2 zing3</em> — kartu identitas</li>
<li><strong>等幾耐？</strong> <em>dang2 gei2 noi6</em> — "Berapa lama menunggunya?"</li>
</ul>
<h2>💡 Yang harus dibawa, setiap kali</h2>
<p>HKID Anda, nomor telepon majikan, dan uang tunai. Banyak klinik tidak menerima kartu untuk kunjungan pertama, dan klinik yang tidak bisa menghubungi majikan Anda tidak bisa menangani pasien di bawah umur. Taruh ketiganya di satu kantong sebelum keluar.</p>
<h2>⏳ Membaca situasi</h2>
<p><strong>等一陣</strong> <em>dang2 jat1 zan6</em> berarti "tunggu sebentar". Di toko itu satu menit. Di klinik itu sepuluh menit sampai dua jam. Bawa buku, charger, dan ekspektasi rendah — dan Anda akan terkejut senang, bukan marah.</p>
<h2>😄 Sejujurnya</h2>
<p>Tidak ada yang menikmati menunggu. Tapi sistem publik di sini benar-benar bagus dan benar-benar murah, dan petugasnya melakukan yang terbaik dengan antrean yang tak berujung. Bersikap ramah di loket bukan hanya baik — itu jalan tercepat.</p>`,
  },

  {
    slug: 'cantonese-health-call-999',
    channel: 'health',
    icon: '🚨',
    status: 'published',
    published_at: '2026-11-02T20:00:00.000Z',
    title_en: 'Calling 999: What to Say in an Emergency',
    title_fil: 'Pagtawag sa 999: Ano ang Sasabihin sa Emergency',
    title_zh: '打999：紧急时该说什么',
    title_id: 'Menelepon 999: Apa yang Harus Dikatakan saat Darurat',
    summary_en:
      'The most important thirty seconds of Cantonese you will ever speak. Learn the shape of the call before you need it.',
    summary_fil:
      'Ang pinakamahalagang tatlumpung segundong Cantonese na sasabihin mo. Pag-aralan ang hugis ng tawag bago ito kailanganin.',
    summary_zh: '你这辈子最重要的一次粤语三十秒。在需要之前，先学会这通电话的样子。',
    summary_id:
      'Tiga puluh detik bahasa Kanton terpenting yang akan Anda ucapkan. Pelajari bentuk panggilannya sebelum dibutuhkan.',
    body_en: `<p>This is the one post in this channel with no joke in it. Learn these words once, calmly, on an ordinary afternoon — because the moment you need them, you will not be calm.</p>
<h2>🚨 The first word</h2>
<p><strong>救命</strong> <em>gau3 meng6</em> — "Help!" Say it first, before anything else. It tells the operator this is not a question about a form; it is an emergency, and they will route you immediately.</p>
<h2>📍 What to say, in this order</h2>
<ul>
<li><strong>我喺…</strong> <em>ngo5 hai2 …</em> — "I am at…" <strong>The address comes first.</strong> Help can be sent while you are still explaining.</li>
<li><strong>有人暈咗</strong> <em>jau5 jan4 wan4 zo2</em> — "Someone has fainted."</li>
<li><strong>流好多血</strong> <em>lau4 hou2 do1 hyut3</em> — "Bleeding a lot."</li>
<li><strong>佢冇呼吸</strong> <em>keoi5 mou5 fu1 kap1</em> — "He is not breathing."</li>
</ul>
<h2>🚑 Who you are calling</h2>
<ul>
<li><strong>救護車</strong> <em>gau3 wu6 ce1</em> — ambulance</li>
<li><strong>消防車</strong> <em>siu1 fong4 ce1</em> — fire engine</li>
<li><strong>警察</strong> <em>ging2 caat3</em> — police</li>
</ul>
<p>999 covers all three. You do not need to choose — say what happened and they will send the right one.</p>
<h2>💡 Three things to do this week</h2>
<p>Learn your full address in Cantonese. Write it on a card and keep it by the door. And note that English is available on 999 — but say 救命 first, so they know it is urgent before they find you an English speaker.</p>`,
    body_fil: `<p>Ito ang nag-iisang post sa channel na ito na walang biro. Pag-aralan ang mga salitang ito nang isang beses, mahinahon, sa isang ordinaryong hapon — dahil sa sandaling kailanganin mo, hindi ka magiging mahinahon.</p>
<h2>🚨 Ang unang salita</h2>
<p><strong>救命</strong> <em>gau3 meng6</em> — "Tulong!" Sabihin ito muna, bago ang lahat. Sinasabi nito sa operator na hindi ito tanong tungkol sa form; emergency ito, at agad kang i-reroute.</p>
<h2>📍 Ano ang sasabihin, sa ayos na ito</h2>
<ul>
<li><strong>我喺…</strong> <em>ngo5 hai2 …</em> — "Nasa… ako." <strong>Address muna.</strong> Makakapagpadala ng tulong habang nagpapaliwanag ka pa.</li>
<li><strong>有人暈咗</strong> <em>jau5 jan4 wan4 zo2</em> — "May nahimatay."</li>
<li><strong>流好多血</strong> <em>lau4 hou2 do1 hyut3</em> — "Maraming dugo."</li>
<li><strong>佢冇呼吸</strong> <em>keoi5 mou5 fu1 kap1</em> — "Wala siyang hininga."</li>
</ul>
<h2>🚑 Sino ang tinatawagan mo</h2>
<ul>
<li><strong>救護車</strong> <em>gau3 wu6 ce1</em> — ambulansya</li>
<li><strong>消防車</strong> <em>siu1 fong4 ce1</em> — fire truck</li>
<li><strong>警察</strong> <em>ging2 caat3</em> — pulis</li>
</ul>
<p>Sakop ng 999 ang tatlo. Hindi mo kailangang pumili — sabihin ang nangyari at sila ang magpapadala ng tama.</p>
<h2>💡 Tatlong gawin ngayong linggo</h2>
<p>Pag-aralan ang buong address mo sa Cantonese. Isulat sa card at ilagay malapit sa pinto. At tandaan: may English sa 999 — pero sabihin muna ang 救命, para malaman nilang urgent bago ka hanapan ng English speaker.</p>`,
    body_zh: `<p>这是这个频道里唯一一篇没有玩笑的文章。在一个普通的下午，平静地学一次——因为真正需要的时候，你不会平静。</p>
<h2>🚨 第一个词</h2>
<p><strong>救命</strong> <em>gau3 meng6</em>——「救命！」先说这个，再说别的。它告诉接线员：这不是在问表格怎么办，这是紧急情况，会立刻转接。</p>
<h2>📍 按这个顺序说</h2>
<ul>
<li><strong>我喺…</strong> <em>ngo5 hai2 …</em>——「我在……」<strong>地址先说。</strong>你还在解释的时候，救援已经在路上了。</li>
<li><strong>有人暈咗</strong> <em>jau5 jan4 wan4 zo2</em>——「有人晕倒了。」</li>
<li><strong>流好多血</strong> <em>lau4 hou2 do1 hyut3</em>——「流很多血。」</li>
<li><strong>佢冇呼吸</strong> <em>keoi5 mou5 fu1 kap1</em>——「他没有呼吸。」</li>
</ul>
<h2>🚑 你打的是谁</h2>
<ul>
<li><strong>救護車</strong> <em>gau3 wu6 ce1</em>——救护车</li>
<li><strong>消防車</strong> <em>siu1 fong4 ce1</em>——消防车</li>
<li><strong>警察</strong> <em>ging2 caat3</em>——警察</li>
</ul>
<p>999 三个都管。你不用选——说发生了什么，他们会派对的来。</p>
<h2>💡 这个星期做三件事</h2>
<p>用粤语学会你的完整地址。写在卡片上，放在门边。还有：999 有英语服务——但先说「救命」，让他们在找英语接线员之前就知道这是急事。</p>`,
    body_id: `<p>Ini satu-satunya tulisan di kanal ini tanpa lelucon. Pelajari kata-kata ini sekali, dengan tenang, di sore biasa — karena saat dibutuhkan, Anda tidak akan tenang.</p>
<h2>🚨 Kata pertama</h2>
<p><strong>救命</strong> <em>gau3 meng6</em> — "Tolong!" Ucapkan ini dulu, sebelum apa pun. Ini memberi tahu operator bahwa ini bukan pertanyaan soal formulir; ini darurat, dan Anda akan langsung dialihkan.</p>
<h2>📍 Apa yang dikatakan, dengan urutan ini</h2>
<ul>
<li><strong>我喺…</strong> <em>ngo5 hai2 …</em> — "Saya di…" <strong>Alamat dulu.</strong> Bantuan bisa dikirim sementara Anda masih menjelaskan.</li>
<li><strong>有人暈咗</strong> <em>jau5 jan4 wan4 zo2</em> — "Ada yang pingsan."</li>
<li><strong>流好多血</strong> <em>lau4 hou2 do1 hyut3</em> — "Banyak berdarah."</li>
<li><strong>佢冇呼吸</strong> <em>keoi5 mou5 fu1 kap1</em> — "Dia tidak bernapas."</li>
</ul>
<h2>🚑 Siapa yang Anda hubungi</h2>
<ul>
<li><strong>救護車</strong> <em>gau3 wu6 ce1</em> — ambulans</li>
<li><strong>消防車</strong> <em>siu1 fong4 ce1</em> — mobil pemadam</li>
<li><strong>警察</strong> <em>ging2 caat3</em> — polisi</li>
</ul>
<p>999 mencakup ketiganya. Anda tidak perlu memilih — katakan apa yang terjadi dan mereka mengirim yang tepat.</p>
<h2>💡 Tiga hal minggu ini</h2>
<p>Pelajari alamat lengkap Anda dalam bahasa Kanton. Tulis di kartu dan simpan dekat pintu. Dan catat: bahasa Inggris tersedia di 999 — tapi ucapkan 救命 dulu, agar mereka tahu ini mendesak sebelum mencari penerjemah.</p>`,
  },

  // =========================================================================
  // FESTIVALS
  // =========================================================================
  {
    slug: 'cantonese-festivals-lunar-new-year',
    channel: 'festivals',
    icon: '🧧',
    status: 'published',
    published_at: '2026-11-03T09:00:00.000Z',
    title_en: 'Lunar New Year: Red Packets, Greetings and the Cleaning Deadline',
    title_fil: 'Lunar New Year: Red Packets, Pagbati at ang Deadline ng Paglilinis',
    title_zh: '农历新年：利是、拜年，还有大扫除的死线',
    title_id: 'Tahun Baru Imlek: Angpao, Ucapan, dan Tenggat Bersih-bersih',
    summary_en:
      'Three days that reorganise the whole household. What to say, what to give, and what never to sweep.',
    summary_fil:
      'Tatlong araw na nagbabago sa buong bahay. Ano ang sasabihin, ano ang ibibigay, at ano ang hindi dapat walisin.',
    summary_zh: '这三天会重调整整个家。该说什么、该给什么，还有绝对不能扫的东西。',
    summary_id:
      'Tiga hari yang menata ulang seluruh rumah. Apa yang dikatakan, apa yang diberikan, dan apa yang tidak boleh disapu.',
    body_en: `<p>Lunar New Year is the biggest week in the Hong Kong calendar, and it reorganises the household around three things: cleaning before, eating during, and visiting after. Learn the deadline first — it is the part that involves you.</p>
<h2>🧧 The words</h2>
<ul>
<li><strong>恭喜發財</strong> <em>gung1 hei2 faat3 coi4</em> — the standard new year greeting. "Wishing you prosperity."</li>
<li><strong>利是</strong> <em>lai6 si6</em> — red packet</li>
<li><strong>拜年</strong> <em>baai3 nin4</em> — new year visits</li>
<li><strong>團年飯</strong> <em>tyun4 nin4 faan6</em> — reunion dinner</li>
<li><strong>年廿八，洗邋遢</strong> <em>nin4 jaa6 baat3, sai2 laat6 taat3</em> — "On the 28th, clean the house."</li>
</ul>
<h2>🧹 The deadline is real</h2>
<p>The cleaning must be finished by the 28th day of the last lunar month. Every helper in Hong Kong is on a ladder that week, and every flat gets rearranged. Start early, ask what goes back where, and do not be surprised if furniture moves.</p>
<h2>🚫 The one thing never to do</h2>
<p>Do not sweep on the first day of the new year. Sweeping on day one sweeps the luck out of the house. If you are handed a broom that day, put it down and ask.</p>
<h2>😄 The honest truth</h2>
<p>This is also the week you may be given a red packet. Accept it with both hands, say <strong>多謝</strong> <em>do1 ze6</em>, and do not open it in front of anyone. It is a gift, not a bonus, and the amount is nobody's business — including yours, until you are alone.</p>`,
    body_fil: `<p>Ang Lunar New Year ang pinakamalaking linggo sa kalendaryo ng Hong Kong, at inaayos nito ang buong bahay sa tatlong bagay: paglilinis bago, pagkain habang, at pagdalaw pagkatapos. Pag-aralan muna ang deadline — iyon ang may kinalaman sa iyo.</p>
<h2>🧧 Ang mga salita</h2>
<ul>
<li><strong>恭喜發財</strong> <em>gung1 hei2 faat3 coi4</em> — ang karaniwang pagbati. "Magkaroon ka ng kasaganaan."</li>
<li><strong>利是</strong> <em>lai6 si6</em> — red packet</li>
<li><strong>拜年</strong> <em>baai3 nin4</em> — pagdalaw sa bagong taon</li>
<li><strong>團年飯</strong> <em>tyun4 nin4 faan6</em> — reunion dinner</li>
<li><strong>年廿八，洗邋遢</strong> <em>nin4 jaa6 baat3, sai2 laat6 taat3</em> — "Sa ika-28, maglinis ng bahay."</li>
</ul>
<h2>🧹 Totoong deadline ito</h2>
<p>Dapat tapos ang paglilinis sa ika-28 araw ng huling buwan sa lunar. Bawat helper sa Hong Kong ay nasa hagdan sa linggong iyon, at bawat flat ay inaayos. Magsimula nang maaga, itanong kung saan ibinabalik ang mga bagay, at huwag magulat kung gumalaw ang muwebles.</p>
<h2>🚫 Ang isang bagay na hindi dapat gawin</h2>
<p>Huwag magwalis sa unang araw ng bagong taon. Ang pagwawalis sa unang araw ay nagwawalis ng suwerte palabas ng bahay. Kapag may nag-abot sa iyo ng walis sa araw na iyon, ibaba ito at magtanong.</p>
<h2>😄 Ang totoo</h2>
<p>Ito rin ang linggong maaaring bigyan ka ng red packet. Tanggapin ng dalawang kamay, sabihin ang <strong>多謝</strong> <em>do1 ze6</em>, at huwag buksan sa harap ng kahit sino. Regalo ito, hindi bonus, at ang halaga ay walang pakialam — pati ikaw, hanggang mag-isa ka na.</p>`,
    body_zh: `<p>农历新年是香港日历上最大的一周，它围绕三件事重调整整个家：年前打扫、年中吃饭、年后拜年。先记住那个死线——那是跟你有关的部分。</p>
<h2>🧧 这些词</h2>
<ul>
<li><strong>恭喜發財</strong> <em>gung1 hei2 faat3 coi4</em>——标准的新年祝福。</li>
<li><strong>利是</strong> <em>lai6 si6</em>——红包</li>
<li><strong>拜年</strong> <em>baai3 nin4</em>——拜年</li>
<li><strong>團年飯</strong> <em>tyun4 nin4 faan6</em>——团年饭</li>
<li><strong>年廿八，洗邋遢</strong> <em>nin4 jaa6 baat3, sai2 laat6 taat3</em>——「年廿八，洗邋遢。」</li>
</ul>
<h2>🧹 这个死线是真的</h2>
<p>大扫除必须在农历最后一个月的廿八之前完成。那一周，香港每个家佣都在梯子上，每个单位都会被重新整理。早点开始，问清楚东西放回哪里，家具移位也别惊讶。</p>
<h2>🚫 唯一绝对不能做的事</h2>
<p>年初一不要扫地。初一扫地，会把好运扫出门。如果那天有人递扫帚给你，放下，然后问。</p>
<h2>😄 实话</h2>
<p>这一周你也可能收到利是。双手接，说<strong>多謝</strong> <em>do1 ze6</em>，而且不要当着人打开。那是礼物，不是奖金；里面多少钱不关别人的事——在你一个人之前，也不关你的事。</p>`,
    body_id: `<p>Tahun Baru Imlek adalah pekan terbesar di kalender Hong Kong, dan ia menata ulang rumah sekitar tiga hal: bersih-bersih sebelumnya, makan selama, dan berkunjung sesudahnya. Pelajari tenggatnya dulu — itu bagian yang melibatkan Anda.</p>
<h2>🧧 Kata-katanya</h2>
<ul>
<li><strong>恭喜發財</strong> <em>gung1 hei2 faat3 coi4</em> — ucapan standar. "Semoga makmur."</li>
<li><strong>利是</strong> <em>lai6 si6</em> — angpao</li>
<li><strong>拜年</strong> <em>baai3 nin4</em> — kunjungan tahun baru</li>
<li><strong>團年飯</strong> <em>tyun4 nin4 faan6</em> — makan malam reuni</li>
<li><strong>年廿八，洗邋遢</strong> <em>nin4 jaa6 baat3, sai2 laat6 taat3</em> — "Tanggal 28, bersihkan rumah."</li>
</ul>
<h2>🧹 Tenggatnya nyata</h2>
<p>Bersih-bersih harus selesai pada hari ke-28 bulan terakhir lunar. Setiap asisten di Hong Kong naik tangga pekan itu, dan setiap flat ditata ulang. Mulai lebih awal, tanyakan barang kembali ke mana, dan jangan kaget kalau furnitur berpindah.</p>
<h2>🚫 Satu hal yang tidak boleh dilakukan</h2>
<p>Jangan menyapu pada hari pertama tahun baru. Menyapu di hari pertama berarti menyapu keberuntungan keluar rumah. Kalau ada yang menyerahkan sapu hari itu, letakkan dan bertanya.</p>
<h2>😄 Sejujurnya</h2>
<p>Pekan ini juga Anda mungkin diberi angpao. Terima dengan dua tangan, ucapkan <strong>多謝</strong> <em>do1 ze6</em>, dan jangan membukanya di depan siapa pun. Itu hadiah, bukan bonus, dan isinya bukan urusan orang lain — termasuk urusan Anda, sampai Anda sendirian.</p>`,
  },

  {
    slug: 'cantonese-festivals-what-not-to-say',
    channel: 'festivals',
    icon: '🚫',
    status: 'published',
    published_at: '2026-11-03T10:00:00.000Z',
    title_en: 'What Not to Say or Give: Cantonese Festival Taboos',
    title_fil: 'Ano ang Hindi Sasabihin o Ibibigay: Mga Taboo sa Pista',
    title_zh: '别说什么、别送什么：粤语节庆禁忌',
    title_id: 'Yang Tak Boleh Dikatakan atau Diberikan: Tabu Festival Kanton',
    summary_en:
      'A clock, a pair of shoes, or the number four can turn a kind gift into an insult. Here is the short list.',
    summary_fil:
      'Isang relo, isang pares ng sapatos, o ang numero cuatro ay puwedeng gawing insulto ang magandang regalo. Narito ang maikling listahan.',
    summary_zh: '一个钟、一双鞋，或者数字四，都能把好意变成冒犯。短清单在这里。',
    summary_id:
      'Sebuah jam, sepasang sepatu, atau angka empat bisa mengubah hadiah baik jadi penghinaan. Ini daftar singkatnya.',
    body_en: `<p>Cantonese culture runs on homophones. A word that sounds like a bad word <em>is</em> a bad word, especially at a festival. This is the shortest useful list you will read this month.</p>
<h2>🚫 The four to avoid</h2>
<ul>
<li><strong>四</strong> <em>sei3</em> — four. Sounds like 死 <em>sei2</em>, "death". Never give four of anything, and never a red packet containing $40.</li>
<li><strong>鐘</strong> <em>zung1</em> — clock. Sounds like 終 <em>zung1</em>, "the end". A clock as a gift means you are counting down someone's life.</li>
<li><strong>鞋</strong> <em>haai4</em> — shoes. Associated with departing, and with evil. Do not gift them.</li>
<li><strong>梨</strong> <em>lei4</em> — pear. Sounds like 離 <em>lei4</em>, "to separate". Do not split one with someone you love.</li>
</ul>
<h2>✅ What is always safe</h2>
<p>Oranges (<strong>桔</strong> <em>gat1</em>, sounds like luck), a box of biscuits, tea, or anything meant to be eaten together. Shared food cannot offend anyone.</p>
<h2>💡 If you are given a clock</h2>
<p>Smile, say <strong>多謝</strong> <em>do1 ze6</em>, and never mention it. The giver may not know either — plenty of younger Hong Kong people have forgotten these rules. There is no polite way to explain a taboo to the person who just broke it.</p>
<h2>😄 The honest truth</h2>
<p>You will break one of these eventually, probably by offering someone a pear. It is a small thing, easily laughed off, and nobody will hold it against a helper who is clearly trying. The rules matter most with grandparents — be careful there.</p>`,
    body_fil: `<p>Umiikot ang kulturang Cantonese sa homophone. Ang salitang tunog-masamang salita <em>ay</em> masamang salita, lalo na sa pista. Ito ang pinakamaikling kapaki-pakinabang na listahan ngayong buwan.</p>
<h2>🚫 Ang apat na iwasan</h2>
<ul>
<li><strong>四</strong> <em>sei3</em> — apat. Tunog ng 死 <em>sei2</em>, "kamatayan". Huwag magbigay ng apat sa kahit ano, at huwag red packet na may $40.</li>
<li><strong>鐘</strong> <em>zung1</em> — relo. Tunog ng 終 <em>zung1</em>, "katapusan". Ang relo bilang regalo ay parang binibilang mo ang buhay ng tao.</li>
<li><strong>鞋</strong> <em>haai4</em> — sapatos. Kaugnay ng pag-alis, at ng kasamaan. Huwag iregalo.</li>
<li><strong>梨</strong> <em>lei4</em> — peras. Tunog ng 離 <em>lei4</em>, "maghiwalay". Huwag hatiin ang isa sa mahal mo.</li>
</ul>
<h2>✅ Ang laging safe</h2>
<p>Orange (<strong>桔</strong> <em>gat1</em>, tunog ng suwerte), isang kahon ng biskwit, tsaa, o kahit anong kakainin nang sama-sama. Ang pagkaing hinahati ay hindi makakasakit ng damdamin.</p>
<h2>💡 Kapag binigyan ka ng relo</h2>
<p>Ngumiti, sabihin ang <strong>多謝</strong> <em>do1 ze6</em>, at huwag nang banggitin. Maaaring hindi rin alam ng nagbigay — maraming kabataang taga-Hong Kong ang nakalimot na sa mga tuntuning ito. Walang magalang na paraan para ipaliwanag ang taboo sa taong kaba-basag lang nito.</p>
<h2>😄 Ang totoo</h2>
<p>Mababali mo rin ang isa sa mga ito, malamang sa pag-aalok ng peras. Maliit na bagay, madaling pagtawanan, at walang magkikimkim laban sa helper na halatang nagsisikap. Pinakamahalaga ang mga tuntunin sa mga lolo't lola — mag-ingat doon.</p>`,
    body_zh: `<p>粤语文化靠谐音运转。听起来像坏话的词，<em>就是</em>坏话，过节时尤其如此。这是你这个月会读到的最短的有用清单。</p>
<h2>🚫 四样要避开</h2>
<ul>
<li><strong>四</strong> <em>sei3</em>——四。听起来像「死」。别送四个任何东西，也别包四十块的利是。</li>
<li><strong>鐘</strong> <em>zung1</em>——钟。听起来像「终」。送钟等于在倒数别人的寿命。</li>
<li><strong>鞋</strong> <em>haai4</em>——鞋。跟「离开」和「邪」都有关。别送。</li>
<li><strong>梨</strong> <em>lei4</em>——梨。听起来像「离」。别跟你在乎的人分一个梨。</li>
</ul>
<h2>✅ 永远安全的</h2>
<p>橘子（<strong>桔</strong> <em>gat1</em>，听起来像「吉」）、一盒饼干、茶叶，或者任何要一起吃的东西。分着吃的食物不会冒犯任何人。</p>
<h2>💡 如果有人送你钟</h2>
<p>笑，说<strong>多謝</strong> <em>do1 ze6</em>，然后永远别提。送的人可能也不知道——不少年轻的香港人早就忘了这些规矩。对于刚犯了禁忌的人，没有礼貌的解释方式。</p>
<h2>😄 实话</h2>
<p>你迟早会犯其中一条，大概是在递梨给别人的时候。这是小事，笑一笑就过去了，没人会记一个明显在努力的家佣的仇。这些规矩在长辈面前最要紧——那里要小心。</p>`,
    body_id: `<p>Budaya Kanton berjalan di atas homofon. Kata yang terdengar seperti kata buruk <em>adalah</em> kata buruk, terutama saat festival. Ini daftar berguna terpendek yang akan Anda baca bulan ini.</p>
<h2>🚫 Empat yang dihindari</h2>
<ul>
<li><strong>四</strong> <em>sei3</em> — empat. Terdengar seperti 死 <em>sei2</em>, "kematian". Jangan memberi empat apa pun, dan jangan angpao berisi $40.</li>
<li><strong>鐘</strong> <em>zung1</em> — jam. Terdengar seperti 終 <em>zung1</em>, "akhir". Jam sebagai hadiah berarti Anda menghitung mundur hidup seseorang.</li>
<li><strong>鞋</strong> <em>haai4</em> — sepatu. Terkait dengan kepergian dan dengan kejahatan. Jangan dihadiahkan.</li>
<li><strong>梨</strong> <em>lei4</em> — pir. Terdengar seperti 離 <em>lei4</em>, "berpisah". Jangan membelahnya dengan orang yang Anda sayangi.</li>
</ul>
<h2>✅ Yang selalu aman</h2>
<p>Jeruk (<strong>桔</strong> <em>gat1</em>, terdengar seperti keberuntungan), sekotak biskuit, teh, atau apa pun yang dimakan bersama. Makanan berbagi tidak bisa menyinggung siapa pun.</p>
<h2>💡 Kalau diberi jam</h2>
<p>Tersenyum, ucapkan <strong>多謝</strong> <em>do1 ze6</em>, dan jangan pernah menyebutnya. Pemberinya mungkin juga tidak tahu — banyak orang Hong Kong muda sudah lupa aturan ini. Tidak ada cara sopan menjelaskan tabu kepada orang yang baru saja melanggarnya.</p>
<h2>😄 Sejujurnya</h2>
<p>Suatu saat Anda akan melanggar salah satunya, mungkin saat menawarkan pir. Itu hal kecil, mudah ditertawakan, dan tidak ada yang akan menyimpan dendam pada asisten yang jelas berusaha. Aturan ini paling penting di depan kakek-nenek — hati-hati di sana.</p>`,
  },

  {
    slug: 'cantonese-festivals-dragon-boat',
    channel: 'festivals',
    icon: '🐉',
    status: 'published',
    published_at: '2026-11-03T11:00:00.000Z',
    title_en: 'Dragon Boat Festival: Rice Dumplings and the Story Behind Them',
    title_fil: 'Dragon Boat Festival: Rice Dumpling at ang Kuwento sa Likod',
    title_zh: '端午节：糭，以及它背后的故事',
    title_id: 'Festival Perahu Naga: Bakcang dan Kisah di Baliknya',
    summary_en:
      'One festival, one food, one very old story about a poet who drowned himself in a river.',
    summary_fil:
      'Isang pista, isang pagkain, isang napakalumang kuwento tungkol sa makatang nalunod sa ilog.',
    summary_zh: '一个节日，一种食物，一个很老的故事——关于一个投江的诗人。',
    summary_id:
      'Satu festival, satu makanan, satu kisah sangat tua tentang penyair yang menenggelamkan diri di sungai.',
    body_en: `<p>Tuen Ng is the most food-focused of the Chinese festivals, and the food has a story attached that is genuinely sad and genuinely old — over two thousand years.</p>
<h2>🐉 The words</h2>
<ul>
<li><strong>端午節</strong> <em>tyun1 ng5 zit3</em> — Tuen Ng, the Dragon Boat Festival</li>
<li><strong>糭</strong> <em>zung2</em> — the rice dumpling (note: different tone from 鐘, "clock")</li>
<li><strong>龍舟</strong> <em>lung4 zau1</em> — dragon boat</li>
<li><strong>扒龍舟</strong> <em>paa4 lung4 zau1</em> — to row a dragon boat</li>
<li><strong>五月五</strong> <em>ng5 jyut6 ng5</em> — the fifth day of the fifth lunar month</li>
</ul>
<h2>📖 The story, briefly</h2>
<p>A poet named Qu Yuan drowned himself in a river to protest a corrupt court. Villagers rowed out to save him — that is the dragon boat race — and threw rice into the water so the fish would eat the rice instead of him. Two thousand years later, we are still eating the rice.</p>
<h2>🥟 How to handle a 糭</h2>
<p>It is steamed, wrapped in leaves, and heavy — sticky rice, pork, sometimes salted egg yolk. Do not eat one cold. Steam it again for twenty minutes. And do not put the leaves down the drain; they block it, every single year, in thousands of flats.</p>
<h2>😄 The honest truth</h2>
<p>Your employer's family will have opinions about which shop makes the best 糭, and those opinions will be strong. Do not take sides. Accept whatever you are given, say 多謝, and remember that a good 糭 is worth the three hours it takes to steam.</p>`,
    body_fil: `<p>Ang Tuen Ng ang pinaka-pokus sa pagkain sa mga pistang Tsino, at ang pagkain ay may kuwentong talagang malungkot at talagang luma — mahigit dalawang libong taon.</p>
<h2>🐉 Ang mga salita</h2>
<ul>
<li><strong>端午節</strong> <em>tyun1 ng5 zit3</em> — Tuen Ng, ang Dragon Boat Festival</li>
<li><strong>糭</strong> <em>zung2</em> — ang rice dumpling (iba ang tono sa 鐘, "relo")</li>
<li><strong>龍舟</strong> <em>lung4 zau1</em> — dragon boat</li>
<li><strong>扒龍舟</strong> <em>paa4 lung4 zau1</em> — magsagwan ng dragon boat</li>
<li><strong>五月五</strong> <em>ng5 jyut6 ng5</em> — ika-limang araw ng ikalimang buwan</li>
</ul>
<h2>📖 Ang kuwento, maikli</h2>
<p>Isang makatang nagngangalang Qu Yuan ang nalunod sa ilog bilang protesta sa corrupt na korte. Sumagwan ang mga taganayon para iligtas siya — iyon ang karera ng dragon boat — at nagtapon ng bigas sa tubig para kainin ng isda sa halip na siya. Dalawang libong taon na, bigas pa rin ang kinakain natin.</p>
<h2>🥟 Paano hawakan ang 糭</h2>
<p>Steamed ito, nakabalot sa dahon, at mabigat — sticky rice, baboy, kung minsan salted egg yolk. Huwag kainin nang malamig. I-steam muli nang dalawampung minuto. At huwag itapon ang dahon sa drain; bumabara ito, taun-taon, sa libu-libong flat.</p>
<h2>😄 Ang totoo</h2>
<p>May opinyon ang pamilya ng amo mo kung aling tindahan ang pinakamasarap na 糭, at matindi ang opinyong iyon. Huwag kumampi. Tanggapin ang ibinibigay, sabihin ang 多謝, at tandaan: sulit ang tatlong oras ng pag-steam para sa isang magandang 糭.</p>`,
    body_zh: `<p>端午是中国节日里最讲究吃的一个，而那种食物背后有一个真的很伤心、也真的很老的故事——两千多年了。</p>
<h2>🐉 这些词</h2>
<ul>
<li><strong>端午節</strong> <em>tyun1 ng5 zit3</em>——端午节</li>
<li><strong>糭</strong> <em>zung2</em>——糭（注意：跟「鐘」的声调不同）</li>
<li><strong>龍舟</strong> <em>lung4 zau1</em>——龙舟</li>
<li><strong>扒龍舟</strong> <em>paa4 lung4 zau1</em>——划龙舟</li>
<li><strong>五月五</strong> <em>ng5 jyut6 ng5</em>——五月初五</li>
</ul>
<h2>📖 故事，简短版</h2>
<p>诗人屈原投江，抗议腐败的朝廷。村民划船去救他——那就是龙舟赛——并把米撒进水里，希望鱼吃米而不是吃他。两千多年过去，我们还在吃那些米。</p>
<h2>🥟 糭怎么处理</h2>
<p>它是蒸的，用叶子包着，很沉——糯米、猪肉，有时还有咸蛋黄。别冷着吃。再蒸二十分钟。还有：叶子别冲进下水道，它每年都会堵，在成千上万个单位里。</p>
<h2>😄 实话</h2>
<p>雇主一家对哪家店的糭最好吃一定很有意见，而且意见会很强烈。别站边。给你的就接，说声多謝，记住：一只好糭，值得蒸那三个小时。</p>`,
    body_id: `<p>Tuen Ng adalah festival Tionghoa yang paling berpusat pada makanan, dan makanannya punya kisah yang benar-benar sedih dan benar-benar tua — lebih dari dua ribu tahun.</p>
<h2>🐉 Kata-katanya</h2>
<ul>
<li><strong>端午節</strong> <em>tyun1 ng5 zit3</em> — Tuen Ng, Festival Perahu Naga</li>
<li><strong>糭</strong> <em>zung2</em> — bakcang (nada berbeda dari 鐘, "jam")</li>
<li><strong>龍舟</strong> <em>lung4 zau1</em> — perahu naga</li>
<li><strong>扒龍舟</strong> <em>paa4 lung4 zau1</em> — mendayung perahu naga</li>
<li><strong>五月五</strong> <em>ng5 jyut6 ng5</em> — hari kelima bulan kelima</li>
</ul>
<h2>📖 Kisahnya, singkat</h2>
<p>Seorang penyair bernama Qu Yuan menenggelamkan diri di sungai sebagai protes terhadap istana yang korup. Penduduk mendayung untuk menyelamatkannya — itulah lomba perahu naga — dan melempar beras ke air agar ikan memakan beras itu, bukan dia. Dua ribu tahun kemudian, kita masih memakan berasnya.</p>
<h2>🥟 Cara menangani 糭</h2>
<p>Dikukus, dibungkus daun, dan berat — beras ketan, daging babi, kadang kuning telur asin. Jangan dimakan dingin. Kukus lagi dua puluh menit. Dan jangan buang daunnya ke saluran air; itu menyumbat, setiap tahun, di ribuan flat.</p>
<h2>😄 Sejujurnya</h2>
<p>Keluarga majikan Anda pasti punya pendapat tentang toko mana yang 糭-nya terbaik, dan pendapat itu kuat. Jangan memihak. Terima apa yang diberikan, ucapkan 多謝, dan ingat: 糭 yang baik sepadan dengan tiga jam mengukusnya.</p>`,
  },

  {
    slug: 'cantonese-festivals-ching-ming',
    channel: 'festivals',
    icon: '🪦',
    status: 'published',
    published_at: '2026-11-03T12:00:00.000Z',
    title_en: 'Ching Ming: Grave-Sweeping Day, Explained Gently',
    title_fil: 'Ching Ming: Araw ng Paglilinis ng Libingan, Ipinaliwanag nang Mahinahon',
    title_zh: '清明：扫墓日，温和地说清楚',
    title_id: 'Ching Ming: Hari Bersih Makam, Dijelaskan dengan Tenang',
    summary_en:
      'A day for tidying family graves, burning paper, and eating together afterwards. Quiet, practical, and not morbid.',
    summary_fil:
      'Araw ng paglilinis ng libingan ng pamilya, pagsunog ng papel, at pagsasalo pagkatapos. Tahimik, praktikal, at hindi morbid.',
    summary_zh: '这一天整理家族墓地、烧纸、然后一起吃饭。安静、务实，并不阴森。',
    summary_id:
      'Hari untuk merapikan makam keluarga, membakar kertas, dan makan bersama sesudahnya. Tenang, praktis, dan tidak muram.',
    body_en: `<p>Ching Ming is a public holiday, and it is one of the few days when a whole Hong Kong family goes somewhere together. It is practical rather than mournful — think of it as a family maintenance day for the people who came before.</p>
<h2>🪦 The words</h2>
<ul>
<li><strong>清明</strong> <em>cing1 ming4</em> — Ching Ming</li>
<li><strong>掃墓</strong> <em>sou2 mou6</em> — sweep the grave</li>
<li><strong>祭祖</strong> <em>zai3 zou2</em> — honour the ancestors</li>
<li><strong>香</strong> <em>hoeng1</em> — incense</li>
<li><strong>衣紙</strong> <em>ji1 zi2</em> — paper offerings</li>
<li><strong>上山</strong> <em>seung5 saan1</em> — literally "go up the hill"; how people say "visit the grave"</li>
</ul>
<h2>👟 What to actually expect</h2>
<p>Graves are often up a slope, and the path is not a path in the rain. Wear shoes you can walk a hill in. Bring water and a hat. The family will be cheerful — this is a family day, not a sad one.</p>
<h2>🔥 Two practical cautions</h2>
<p>Burning offerings happens in the open, and hill fires are a real risk in dry weather. Keep the fire small and never leave it. And never step over a grave or move an offering that is not yours.</p>
<h2>😄 The honest truth</h2>
<p>If the family invites you along, go. You will be standing on a hillside in the sun with three generations, and someone will hand you an orange. That hour teaches you more about the household than a month of instructions — and it is the clearest sign that they count you as part of it.</p>`,
    body_fil: `<p>Pampublikong holiday ang Ching Ming, at isa ito sa iilang araw na sabay-sabay pumupunta ang buong pamilyang Hong Kong sa isang lugar. Praktikal ito kaysa malungkot — isipin mo itong araw ng pag-aayos ng pamilya para sa mga nauna sa iyo.</p>
<h2>🪦 Ang mga salita</h2>
<ul>
<li><strong>清明</strong> <em>cing1 ming4</em> — Ching Ming</li>
<li><strong>掃墓</strong> <em>sou2 mou6</em> — maglinis ng libingan</li>
<li><strong>祭祖</strong> <em>zai3 zou2</em> — parangalan ang mga ninuno</li>
<li><strong>香</strong> <em>hoeng1</em> — insenso</li>
<li><strong>衣紙</strong> <em>ji1 zi2</em> — paper offerings</li>
<li><strong>上山</strong> <em>seung5 saan1</em> — "umakyat sa burol"; ito ang tawag sa pagdalaw sa libingan</li>
</ul>
<h2>👟 Ano ang talagang aasahan</h2>
<p>Madalas nasa gilid ng burol ang mga libingan, at hindi na daan ang landas kapag umuulan. Magsuot ng sapatos na kayang umakyat. Magdala ng tubig at sombrero. Masaya ang pamilya — araw ito ng pamilya, hindi araw ng lungkot.</p>
<h2>🔥 Dalawang praktikal na paalala</h2>
<p>Sa labas ginagawa ang pagsunog, at totoong panganib ang sunog sa burol kapag tuyo ang panahon. Maliit lang ang apoy at huwag iwanan. At huwag tumapak sa libingan o gumalaw ng alay na hindi sa iyo.</p>
<h2>😄 Ang totoo</h2>
<p>Kapag inimbita ka ng pamilya, sumama ka. Tatayo ka sa gilid ng burol sa ilalim ng araw kasama ang tatlong henerasyon, at may mag-aabot sa iyo ng orange. Mas marami kang matututunan tungkol sa pamilya sa isang oras na iyon kaysa isang buwang utos — at ito ang pinakamalinaw na tanda na itinuturing ka nilang bahagi nito.</p>`,
    body_zh: `<p>清明是公众假期，也是少数几个整个香港家庭会一起出门的日子。它务实多于哀伤——把它想成「为前人做的一次家庭维护日」。</p>
<h2>🪦 这些词</h2>
<ul>
<li><strong>清明</strong> <em>cing1 ming4</em>——清明</li>
<li><strong>掃墓</strong> <em>sou2 mou6</em>——扫墓</li>
<li><strong>祭祖</strong> <em>zai3 zou2</em>——祭祖</li>
<li><strong>香</strong> <em>hoeng1</em>——香</li>
<li><strong>衣紙</strong> <em>ji1 zi2</em>——衣纸</li>
<li><strong>上山</strong> <em>seung5 saan1</em>——字面是「上山」，也就是去扫墓</li>
</ul>
<h2>👟 实际会怎样</h2>
<p>墓地常常在斜坡上，下雨时那条路就不算路了。穿能爬山的鞋。带水和帽子。一家人会是有说有笑的——这是家庭日，不是悲伤的日子。</p>
<h2>🔥 两个实际提醒</h2>
<p>烧衣纸是在户外进行的，天气干燥时山火是真风险。火要小，人不能走开。还有：别跨过别人的坟，别动不属于你的祭品。</p>
<h2>😄 实话</h2>
<p>如果这家人邀你一起去，就去。你会站在山坡上、晒着太阳，身边是三代人，然后有人递给你一个橘子。那一个小时让你了解这个家，比一个月的指令还多——而且那是最清楚的信号：他们把你算作其中一员。</p>`,
    body_id: `<p>Ching Ming adalah hari libur nasional, dan salah satu dari sedikit hari ketika seluruh keluarga Hong Kong pergi ke suatu tempat bersama. Ini praktis, bukan muram — anggap saja hari perawatan keluarga untuk mereka yang lebih dulu ada.</p>
<h2>🪦 Kata-katanya</h2>
<ul>
<li><strong>清明</strong> <em>cing1 ming4</em> — Ching Ming</li>
<li><strong>掃墓</strong> <em>sou2 mou6</em> — membersihkan makam</li>
<li><strong>祭祖</strong> <em>zai3 zou2</em> — menghormati leluhur</li>
<li><strong>香</strong> <em>hoeng1</em> — dupa</li>
<li><strong>衣紙</strong> <em>ji1 zi2</em> — persembahan kertas</li>
<li><strong>上山</strong> <em>seung5 saan1</em> — harfiah "naik bukit"; cara orang menyebut "ziarah makam"</li>
</ul>
<h2>👟 Apa yang sebenarnya diharapkan</h2>
<p>Makam sering di lereng bukit, dan jalannya bukan jalan saat hujan. Pakai sepatu yang bisa dipakai mendaki. Bawa air dan topi. Keluarganya akan ceria — ini hari keluarga, bukan hari duka.</p>
<h2>🔥 Dua peringatan praktis</h2>
<p>Pembakaran dilakukan di luar, dan kebakaran bukit adalah risiko nyata saat kering. Jaga api tetap kecil dan jangan ditinggal. Dan jangan melangkahi makam atau memindahkan persembahan yang bukan milik Anda.</p>
<h2>😄 Sejujurnya</h2>
<p>Kalau keluarga mengajak, ikutlah. Anda akan berdiri di lereng bukit di bawah matahari bersama tiga generasi, dan seseorang akan menyerahkan jeruk. Satu jam itu mengajari Anda lebih banyak tentang rumah tangga itu daripada sebulan instruksi — dan itu tanda paling jelas bahwa mereka menghitung Anda sebagai bagiannya.</p>`,
  },
];
