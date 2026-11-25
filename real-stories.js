/**
 * CantoBuddy — the editorial "real stories" shelf.
 *
 * WHY THIS IS A MODULE AND NOT ROWS IN `stories`.
 * The `stories` table is a MODERATION QUEUE: a helper writes her own story, it
 * lands as `pending`, and NOTHING is public until a human approves it. That is
 * the whole promise of the feature, and tools/stories-test.js pins it with
 * eight assertions ("the public shelf is empty", "nothing is published yet",
 * …). Inserting pre-approved rows into that table would break the promise and
 * the tests along with it.
 *
 * These four are different in kind. They are CantoBuddy RETELLINGS of published
 * journalism about real domestic helpers — written by the operator, reviewed
 * before shipping, and carrying a clickable source on every page. They are not
 * user submissions, they have no learner_id, they never enter the moderation
 * queue, and they cannot be edited or approved from the admin screen. db.js
 * merges them into the three PUBLIC read paths only.
 *
 * ACCURACY RULES, and they are not decorative:
 *   - Every fact here was verified by fetching the source article itself.
 *   - Every sentence inside quotation marks is verbatim from that article
 *     (a quote from the helper, or from her published writing). Typos in the
 *     original are left in and flagged, not silently corrected.
 *   - No person, event, date, feeling or detail has been invented. Where an
 *     article did not say something, it is not said here.
 *   - Each story opens by saying plainly that it is a retelling, and closes
 *     with the publisher, headline and date. The URL is a first-class field so
 *     both the app reader and the server-rendered page can link to it.
 *
 * Bodies are PLAIN TEXT. Both renderers escape them and split on blank lines;
 * HTML here would be shown to the reader as literal markup.
 *
 * SOURCES (fetched and read 2026-11-06):
 *   [1] The SUN HK, "Helpers let voices heard in new ebook", 30 Oct 2016
 *       https://www.sunwebhk.com/2016/10/helpers-let-voices-heard-in-new-ebook.html
 *   [2] The SUN HK, Vir B. Lumicao, "Filipina domestic worker launches book
 *       of poems", 21 Jun 2021
 *       https://www.sunwebhk.com/2021/06/filipina-domestic-worker-launches.html
 *   [3] Hong Kong Free Press, Hillary Leung, "Poetry as 'therapy': Hong Kong's
 *       domestic workers muse about love, sacrifice in their home away from
 *       home", 9 Mar 2024 (updated 13 Mar 2024)
 *       https://hongkongfp.com/2024/03/09/poetry-as-therapy-hong-kongs-domestic-workers-write-about-love-sacrifice-in-their-home-away-from-home/
 */
'use strict';

/** The date CantoBuddy published these retellings (HKT 6 Nov 2026). */
const PUBLISHED = '2026-11-05T16:00:00Z';

const REAL_STORIES = [
  {
    id: null,
    slug: 'three-small-promises-eunice-sacliwan',
    display_name: 'Eunice Sacliwan · The SUN HK',
    lang: 'en',
    topic: 'background',
    title: 'Three small promises',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are Eunice Sacliwan's own, from her essay. Nothing here has been made up.

Eunice Sacliwan left her son when he was three years old. She went to work far from home so she could keep three small promises she had made to him.

"I promised my son a toy. I promised him a pair of shoes. I promised him clothes. That's why I'm here…"

A toy. A pair of shoes. Clothes. They are not big things. But they were big enough to carry a mother across a sea.

Her essay, "I Promised My Son a Toy", became one of 18 short stories, poems and essays written by foreign domestic helpers in Hong Kong. In October 2016, HelperChoice gathered them into a free ebook called Wishing Well: Voices from Foreign Domestic Workers in Hong Kong and Beyond. The pieces came from the second "Be a Journalist" writing competition, held in April 2016 with the support of the news site Coconuts. The book was co-edited by Ju-chen Chen and Min Lee.

Laurence Fauchon, the founder of HelperChoice, said the submissions offered "heart-wrenching yet uplifting insights". She hoped employers who read them would understand their helpers a little better.

Sacliwan did not pretend the work was easy. She ended her essay with this:

"I have started, and I'll carry on. No matter how its much it hurts, no matter how many tears and how much sweat I shed, I will keep these promises."

(The words "how its much" appear exactly that way in the published report.)

Many helpers will recognise this feeling: you are far away, you are tired, and the reason you keep going is very small and very concrete. A toy. Shoes. Clothes. A child waiting at home.

Source: The SUN HK, "Helpers let voices heard in new ebook", 30 October 2016. Retold from the original report; the full source link is below.`,
    published_at: PUBLISHED,
    updated_at: PUBLISHED,
    source_name: 'The SUN HK',
    source_title: 'Helpers let voices heard in new ebook',
    source_date: '30 October 2016',
    source_url: 'https://www.sunwebhk.com/2016/10/helpers-let-voices-heard-in-new-ebook.html',
    editorial: true,
  },

  {
    id: null,
    slug: '105-poems-after-dark-ailenemae-ramos',
    display_name: 'Ailenemae Ramos · The SUN HK',
    lang: 'en',
    topic: 'background',
    title: '105 poems after dark',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are Ailenemae Ramos's own, from the introduction to her book.

Ailenemae Ramos came to work in Hong Kong in July 2010. She had kept a diary since she was young. In Hong Kong she found time to write during her rest hours, normally late at night, and those late-night entries slowly turned into poems — 105 of them.

On Sunday 20 June 2021 she launched them as a book, Beyond the Sunset, at the University of Hong Kong. About 30 people came to a conference hall in the Jockey Club Tower. The event was co-hosted by Migrant Writers of Hong Kong, Share HK and the HKU Sociology Department. Ramos read her poem "I Am Woman", and other helper-writers read six more poems from the collection. Consul Robert Quintin was the guest speaker.

The poems are about sadness, anxiety, hope, love and self-confidence. Ramos said she wanted the book to carry hope.

Her mother died when Ramos was two years old. In the introduction to her book she wrote:

"I grew up with hope in my heart that my mother is watching me beyond each sunset. Many times I found myself crying and talking in the dusk as if it was alive and I asked for guidance."

Ramos was a mother of two teenage children. During the pandemic she would rather stay in her room and write poems, or join online poetry readings with Migrant Writers members in Hong Kong and Singapore.

On 30 March 2021 she founded Migrant Writers of Hong Kong with Maria Nemy Lou Rocio and Liezel Fernandez Marcos. In barely three months the group had 158 members. Ramos said she and Rocio kept asking Dr Julie Ham of the HKU Sociology Department for guidance and support. Beyond the Sunset was the first published work by a member of the group.

What stays with you is not only the book. It is the picture of a woman who had no free daylight hours, and made a writing life out of the quiet ones.

Source: The SUN HK, "Filipina domestic worker launches book of poems" by Vir B. Lumicao, 21 June 2021. Retold from the original report; the full source link is below.`,
    published_at: PUBLISHED,
    updated_at: PUBLISHED,
    source_name: 'The SUN HK',
    source_title: 'Filipina domestic worker launches book of poems',
    source_date: '21 June 2021',
    source_url: 'https://www.sunwebhk.com/2021/06/filipina-domestic-worker-launches.html',
    editorial: true,
  },

  {
    id: null,
    slug: 'writing-is-a-kind-of-therapy-respicio',
    display_name: 'Maria Editha Garma-Respicio · HKFP',
    lang: 'en',
    topic: 'interesting',
    title: 'Writing is a kind of therapy',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are Maria Editha Garma-Respicio's own — spoken to Hong Kong Free Press, or taken from her poem.

As a teenager in Tuguegarao, a city in the northern Philippines, Maria Editha Garma-Respicio wrote for her school newspaper, read in the library and filled pages with poems about love. She sought solace in the written word when all else seemed to be falling apart.

"I wrote about everything," she said. "I wrote about my emotions, being in love, everything."

Decades later she was 45, working as a domestic worker in Hong Kong, and still writing — now about life as a migrant worker, and about her two children back home.

"Writing is a kind of therapy for me," she told Hong Kong Free Press. "It's healing."

In March 2024 two of her poems appeared in a new anthology called Ingat, a Tagalog word that means "take care". The book was a collaboration between Migrant Writers of Hong Kong, the photography non-profit Lensational and the independent publisher Small Tune Press. It gathered poems, photographs and sketches by dozens of domestic workers, telling stories about family, hardship, love and sacrifice. Every work came with a Chinese translation so Hong Kong readers could read it too. The dust jacket paid tribute to balikbayan boxes — the big cardboard boxes of food, clothes and gifts that helpers send home to their families.

Her two poems were Diaspora Spirit, a tribute to the courage of migrant workers, and Adios, about a tearful farewell to her family in the Philippines. These lines are from Adios:

"Goodbye's a torture, my tears shedding
I'll no longer witness my baby's milestone
Others children I will be caring
Making me numb like an ice stone"

Those lines are printed that way in the report; the wording is hers.

It is a small, ordinary thing: a notebook, a pen, a rest day. But for her it is how a person stays whole while living far from the people she loves.

Source: Hong Kong Free Press, "Poetry as 'therapy': Hong Kong's domestic workers muse about love, sacrifice in their home away from home" by Hillary Leung, 9 March 2024 (updated 13 March 2024). Retold from the original report; the full source link is below.`,
    published_at: PUBLISHED,
    updated_at: PUBLISHED,
    source_name: 'Hong Kong Free Press',
    source_title: "Poetry as 'therapy': Hong Kong's domestic workers muse about love, sacrifice in their home away from home",
    source_date: '9 March 2024',
    source_url: 'https://hongkongfp.com/2024/03/09/poetry-as-therapy-hong-kongs-domestic-workers-write-about-love-sacrifice-in-their-home-away-from-home/',
    editorial: true,
  },

  {
    id: null,
    slug: 'two-hearts-saying-goodbye-ventura',
    display_name: 'Kristine Andaya Ventura · HKFP',
    lang: 'en',
    topic: 'interesting',
    title: 'Two hearts saying goodbye',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are Kristine Andaya Ventura's own, spoken to Hong Kong Free Press.

Kristine Andaya Ventura was 36 when she spoke to Hong Kong Free Press in 2024. She had been working overseas as a domestic worker since she was 19 — first in Lebanon, then Saudi Arabia, Dubai and Malaysia. She came to Hong Kong at the end of 2022.

Her contribution to the anthology Ingat was a drawing: a sketch of a couple paddling a boat under the full moon.

"[My sketch] is about two hearts saying goodbye. No matter how happy they are today, tomorrow they need to say goodbye to separate, to have a good future," she said.

She is a writer as well as an artist, having penned dozens of poems over the years. In 2021 she published a collection called She is a Lioness, telling stories about heartbreak over a failed marriage, battling depression, and life as a domestic worker in a foreign land. A poem she dedicated to her daughter is called "Please Let Me".

Her main writing inspiration, she said, was her two children, aged eight and 17.

"I want to dedicate [my poems] to them [to show] how I love them and miss them," she said. "When I miss them, I will express that I need to work outside the country for them… to give them financial support."

"Writing helps me ease the pain," she added.

There is no promise that the distance ends soon, and no tidy ending. What there is instead is a woman who can say exactly why she is here, and who has found a way to put that love somewhere it will keep.

Source: Hong Kong Free Press, "Poetry as 'therapy': Hong Kong's domestic workers muse about love, sacrifice in their home away from home" by Hillary Leung, 9 March 2024 (updated 13 March 2024). Retold from the original report; the full source link is below.`,
    published_at: PUBLISHED,
    updated_at: PUBLISHED,
    source_name: 'Hong Kong Free Press',
    source_title: "Poetry as 'therapy': Hong Kong's domestic workers muse about love, sacrifice in their home away from home",
    source_date: '9 March 2024',
    source_url: 'https://hongkongfp.com/2024/03/09/poetry-as-therapy-hong-kongs-domestic-workers-write-about-love-sacrifice-in-their-home-away-from-home/',
    editorial: true,
  },

  // ---- Scheduled daily shelf, 27 Nov - 1 Dec 2026 (two stories a day) -------
  // Each is a short CantoBuddy retelling of a fetched, published report. Words
  // in quotation marks are verbatim from that source. Nothing is invented.
  {
    id: null,
    slug: 'the-best-alarm-clock-jumi',
    display_name: 'Jumiyati · Mothership',
    lang: 'en',
    topic: 'background',
    title: 'The best alarm clock',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are from the report. Nothing here has been made up.

Jumiyati, known to the Ng family as Jumi, worked for them in Singapore for six years, from 2008 to 2014. She was the one who knocked on Elvin Ng's door each morning to wake him for long days of filming. He called her his "best alarm clock".

When Elvin's father died in 2012, Jumi stayed close to his mother. They walked together from their old home in western Singapore to Chinese Garden. Elvin said she "helped the family tide over that period in a very silent and quiet way".

Twelve years after Jumi went home to Indonesia, Elvin and his mother travelled to Depok to surprise her. They brought pineapple tarts — the snack Jumi had once learned to make from his mother. Jumi had thought the film crew was making a programme about former domestic helpers. When she saw the tarts and the card, she cried. Then she saw Elvin and his mother standing there.

She kept their old gifts all those years: a wallet Elvin had given her, and recipes she had written down for chicken rice, prawn mee and pineapple tarts. Elvin said he could not even remember giving her the wallet. "I didn't know that we held such an important place in her heart," he said.

The visit ended with a trip to Jakarta for Jumi and her children. Three days, Elvin said, were enough: "It's not measured in length. It's measured in closeness."

Source: Mothership, "Elvin Ng & mother have emotional reunion with former helper in Indonesia after 12 years", 24 August 2026. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-26T01:00:00Z',
    updated_at: '2026-11-26T01:00:00Z',
    source_name: 'Mothership',
    source_title: 'Elvin Ng & mother have emotional reunion with former helper in Indonesia after 12 years',
    source_date: '24 August 2026',
    source_url: 'https://mothership.sg/2026/08/elvin-ng-reunite-helper',
    editorial: true,
  },

  {
    id: null,
    slug: 'you-take-care-of-everyone-but-yourself',
    display_name: 'Auntie Mas · CNA',
    lang: 'en',
    topic: 'interesting',
    title: 'You take care of everyone but yourself',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are from the report. Nothing here has been made up.

Muslichah Abdullah — "Auntie Mas" — cared for Leticia Peh and her three siblings for about twelve years. When Leticia was a child with undiagnosed hearing loss, Auntie Mas would notice she came home upset, make food and comfort her. The youngest child, Lenette, was born with Down syndrome. Auntie Mas once told their father: "Sir, if you don't want her, I'm going to bring her home."

After eleven years apart, Leticia travelled to Kudus, Indonesia, to surprise her. Auntie Mas stared at her and said: "I feel like (it's a) dream."

Then Leticia saw how her former helper was living. After twenty years in Singapore, Auntie Mas rented a single room. Her sons lived elsewhere, and her grandchildren were not close because she had been away so long. She had built a house with her sister, then gave it to her when the sister asked for it.

Leticia broke down. "Auntie Mas, you always say (you're) very okay, but it doesn't look like you're okay," she said. "You always take care of everyone but yourself." Auntie Mas only said: "Don't cry."

Leticia started a fundraiser for her. She wrote that she wanted to help Auntie Mas find a new dream — "whether it be a home she can call her own or anything else".

Source: CNA, "'Guardian angel' teacher made him feel seen as a child; hearts melt online as they reunite", 24 September 2026. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
    source_name: 'CNA',
    source_title: "'Guardian angel' teacher made him feel seen as a child; hearts melt online as they reunite",
    source_date: '24 September 2026',
    source_url: 'https://www.channelnewsasia.com/cna-insider/insider/guardian-angel-reunions-finding-teacher-auntie-former-domestic-helper-6404371',
    editorial: true,
  },

  {
    id: null,
    slug: 'a-suitcase-of-sincerity',
    display_name: 'MICROLAB Collective · HKFP',
    lang: 'en',
    topic: 'interesting',
    title: 'A suitcase of sincerity',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are from the book or the report. Nothing here has been made up.

Fifteen Indonesian migrant domestic workers wrote a book called What We Carry, Under the Same Sky. It holds essays, poems, photographs and drawings about the journey from their villages in Indonesia to work in Hong Kong.

In one chapter, a worker chose a photograph of suitcases lined up at airport check-in counters. Under it she wrote: "Leaving behind family, children, parents – we store our feelings of longing, pain, discrimination in a suitcase of sincerity."

The book was launched on International Women's Day, 8 March 2026. At the launch, the writers made people laugh as they described their first days in Hong Kong and the misunderstandings that came with a new language.

A suitcase is an ordinary thing. But for someone who packs her whole life into one and flies away from the people she loves, it can hold more than clothes. It can hold feelings she cannot say out loud.

Source: Hong Kong Free Press, "What they carry: The unseen burdens of migrant domestic workers in Hong Kong" by Sringatin and MICROLAB Collective, 14 June 2026. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-27T01:00:00Z',
    updated_at: '2026-11-27T01:00:00Z',
    source_name: 'Hong Kong Free Press',
    source_title: 'What they carry: The unseen burdens of migrant domestic workers in Hong Kong',
    source_date: '14 June 2026',
    source_url: 'https://hongkongfp.com/2026/06/14/what-they-carry-the-unseen-burdens-of-migrant-domestic-workers-in-hong-kong/',
    editorial: true,
  },

  {
    id: null,
    slug: 'the-word-tang',
    display_name: 'MICROLAB Collective · HKFP',
    lang: 'en',
    topic: 'interesting',
    title: 'The word tang',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. Nothing here has been made up.

When the writers of What We Carry, Under the Same Sky met readers at their book launch in Hong Kong, the room filled with laughter. They told the audience about their first days in a new language — and one word in particular: "tang".

The report says the workers mistook "tang" for the word for "chair". Their employer meant something else: "wait", or "lamp". A small misunderstanding, but the kind that happens every day when you are living inside a language that is not yours.

The writers turned those moments into humour. The report describes their book as moving from life back home in Indonesia, through the challenges of working overseas, to friendship on days off and dreams for the future.

Anyone learning Cantonese knows this feeling. You hear a sound, you guess, you smile, and sometimes everybody laughs. The laugh is not the point — the point is that you kept trying.

Source: Hong Kong Free Press, "What they carry: The unseen burdens of migrant domestic workers in Hong Kong" by Sringatin and MICROLAB Collective, 14 June 2026. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-27T10:00:00Z',
    updated_at: '2026-11-27T10:00:00Z',
    source_name: 'Hong Kong Free Press',
    source_title: 'What they carry: The unseen burdens of migrant domestic workers in Hong Kong',
    source_date: '14 June 2026',
    source_url: 'https://hongkongfp.com/2026/06/14/what-they-carry-the-unseen-burdens-of-migrant-domestic-workers-in-hong-kong/',
    editorial: true,
  },

  {
    id: null,
    slug: 'a-place-at-the-table',
    display_name: 'Ashlyn Guiapar Mato · PhilNews',
    lang: 'en',
    topic: 'background',
    title: 'A place at the table',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are from the social-media caption quoted in the report. Nothing here has been made up.

A Facebook user named Ashlyn Guiapar Mato shared a short video of her employer at meal time. In the video, the employer serves food not only to his own children but to their domestic helper as well.

The caption read: "MashaAllah ganito amo ko sakenswerte mo pag ganito amo mo" — a Filipino way of saying, in effect, lucky is the person whose employer is like this.

The video spread quickly and drew warm reactions online. People praised the employer for a gesture that was very ordinary: making sure the woman who takes care of the family also has a place at the table.

It is a small thing, but small things are what a working day is made of. Who eats first. Who is thanked. Who is included.

Source: PhilNews, "Video of Foreign Employer Treating His Helper Kindly Goes Viral Online", 4 August 2021. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-28T01:00:00Z',
    updated_at: '2026-11-28T01:00:00Z',
    source_name: 'PhilNews',
    source_title: 'Video of Foreign Employer Treating His Helper Kindly Goes Viral Online',
    source_date: '4 August 2021',
    source_url: 'https://philnews.ph/2021/08/04/video-foreign-employer-treating-his-helper-kindly-goes-viral/',
    editorial: true,
  },

  {
    id: null,
    slug: 'my-mother-became-my-father',
    display_name: 'Rodelyn De Vera · The Filipino Times',
    lang: 'en',
    topic: 'background',
    title: 'My mother became my father',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are from Rodelyn De Vera, in the Filipino she used. Nothing here has been made up.

Rodelyn De Vera's father died in 1995. Her mother, Helen Cawile De Vera, went to Singapore to work as a domestic helper so the children could stay in school. She later cleaned homes in Belgium for three years, and is now working in Japan, again as a helper.

Rodelyn wrote that her mother "chose to pour all her love on us siblings". In her own words: "Since 1995 po, hindi pa nag-stop mag work si mama hanggang ngayon po."

Helen was diagnosed with stage 4 lung cancer in 2019, yet she kept working. Rodelyn said her employers in Tokyo were paying for her treatment. "But still, we thank God at may mga mabubuting tao pong gumagabay sa kanya sa Japan," she said.

Rodelyn is now an overseas worker herself in Abu Dhabi, caring for her own daughter. "Sobrang proud po ako sa nanay ko na naging tatay din sa aming magkakapatid," she said — she is proud of a mother who became a father to them all.

Source: The Filipino Times, "'Happy Father's Day Mama!' OFW shares sacrifices of mom who supported them until graduation as a domestic helper", 21 June 2020. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-28T10:00:00Z',
    updated_at: '2026-11-28T10:00:00Z',
    source_name: 'The Filipino Times',
    source_title: "'Happy Father's Day Mama!' OFW shares sacrifices of mom who supported them until graduation as a domestic helper",
    source_date: '21 June 2020',
    source_url: 'https://filipinotimes.net/feature/2020/06/21/happy-fathers-day-mama-ofw-shares-sacrifices-of-mom-who-supported-them-until-graduation-as-a-domestic-helper/',
    editorial: true,
  },

  {
    id: null,
    slug: 'best-nanny-melanie-manansala',
    display_name: 'Melanie Manansala · PhilNews',
    lang: 'en',
    topic: 'background',
    title: 'Best nanny of the year',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are Melanie Manansala's own, quoted in the report. Nothing here has been made up.

Melanie Manansala was 44 when she was named best nanny in the United Arab Emirates, out of about 500 nominees. She had served a Lebanese family for twelve years and kept a good relationship with them even after moving to a new employer.

The award came with a retirement fund of one million Philippine pesos and a free flight home, sponsored by Air Arabia. The ceremony was hosted by Rise, a wealth-management platform for migrant workers. Melanie was the second Filipina domestic helper in a row to receive the award.

"I think I am proud of my job because I love what I'm doing," she said. "I like being with children, they return the love that you give to them."

That line says something important: the love goes both ways. Care work is still work, but it is also a relationship, and twelve years of it cannot be dismissed as "lowly", as the report notes some people still do.

Source: PhilNews, "Filipina Wins As Best Nanny In UAE, Bags Retirement Fee Amounting P1-M", 30 November 2017. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-29T01:00:00Z',
    updated_at: '2026-11-29T01:00:00Z',
    source_name: 'PhilNews',
    source_title: 'Filipina Wins As Best Nanny In UAE, Bags Retirement Fee Amounting P1-M',
    source_date: '30 November 2017',
    source_url: 'https://philnews.ph/2017/11/30/filipina-wins-best-nanny-uae-bag-retirement-fee-amounting-p1-m/',
    editorial: true,
  },

  {
    id: null,
    slug: 'proud-in-a-quiet-way',
    display_name: 'A Pinay helper · Humans of New York',
    lang: 'en',
    topic: 'interesting',
    title: 'Proud in a quiet way',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are the helper's own, from the Humans of New York post quoted in the report. Nothing here has been made up.

She left the Philippines at twenty-one, just after her father died of cancer. There were four brothers and four sisters, and no work in their province. "There was nobody to support us," she said.

Fifteen years later she was still working, as a domestic helper in Hong Kong. Her employers had been kind, she said, but the years away were long. "It's been a hard battle for me. It's been a sad life."

Then she added the other half of the truth: "But victorious in a way, too. Because I've seen my family better than before." Three of her siblings graduated from university with her help. She paid school fees for many nieces and nephews.

"Being a domestic helper is a tough job, but it's a clean job. It's an honest job," she said. "I don't want to seem like I'm boasting… But proud in a way like I did my part."

She finished her goal and was ready to go home for good when her contract ended.

Source: The Filipino Times, "Pinay OFW featured in Humans of New York, tells hardship of domestic helpers", 2 November 2019. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-29T10:00:00Z',
    updated_at: '2026-11-29T10:00:00Z',
    source_name: 'The Filipino Times',
    source_title: 'Pinay OFW featured in Humans of New York, tells hardship of domestic helpers',
    source_date: '2 November 2019',
    source_url: 'https://filipinotimes.net/news/2019/11/02/pinay-ofw-featured-humans-new-york-tells-hardship-domestic-helpers/',
    editorial: true,
  },

  {
    id: null,
    slug: 'an-iphone-after-two-years',
    display_name: 'A househelp · TUKO',
    lang: 'en',
    topic: 'background',
    title: 'An iPhone after two years',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are from the TikTok caption quoted in the report. Nothing here has been made up.

A domestic worker in Saudi Arabia finished two years with the same family. At the end of the contract, they gave her a brand-new iPhone as an Eid gift.

The moment was shared on TikTok on 3 August 2026 by the account walaad158. In the video, the worker is overcome with joy. The caption read in part: "Eidyah for khadamah. Thank you, my employer. God bless you all, the best family. I love you very much. Thank for everything."

An Eidyah is a traditional gift given during the Eid festive period. But the report points out that this one carried more than its price: it marked two years of daily life under the same roof, and a farewell to people she had come to regard as more than employers.

She was, the report says, "visibly overwhelmed with joy".

Source: TUKO.co.ke, "Saudi Boss Gifts Househelp Brand-New iPhone after Completing Her Contract: 'We Are One Family'", 3 August 2026. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-30T01:00:00Z',
    updated_at: '2026-11-30T01:00:00Z',
    source_name: 'TUKO.co.ke',
    source_title: "Saudi Boss Gifts Househelp Brand-New iPhone after Completing Her Contract: 'We Are One Family'",
    source_date: '3 August 2026',
    source_url: 'https://www.tuko.co.ke/people/639524-saudi-boss-gifts-hosuehelp-brand-iphone-completing-contract-family',
    editorial: true,
  },

  {
    id: null,
    slug: 'the-air-cooler-surprise',
    display_name: 'A house help · News18',
    lang: 'en',
    topic: 'interesting',
    title: 'The air cooler surprise',
    gloss_en: '',
    body: `This is a CantoBuddy retelling of a published report. The words in quotation marks are from the video and its caption, as quoted in the report. Nothing here has been made up.

An Instagram account called @lifeofcocoandchico, known for videos of two pet Shih Tzus, posted a short clip in April 2026. It shows a domestic worker cleaning the kitchen. Her employer calls her and says: "Sister, I have something for you."

The worker follows her into another room and asks, "Kya hai? (What is it?)" Inside is a large wrapped gift: an air cooler, for the intense summer heat. The report says her face lit up, she squealed with joy and hugged her employer.

The caption explained the relationship: "We take care of our house help who takes care of us and our dogs like her own kids."

Within 24 hours the video had passed 1.8 million views. One commenter wrote: "The way she hugs you shows the comfort zone you've created for her… rare to see." Another said she was "watching this on repeat and smiling".

Source: News18, reproduced by Daily 8, "Family Surprises House Help With Air Cooler Ahead Of Summer, Viral Video Leaves Internet Teary-Eyed", 12 April 2026. Retold from the original report; the full source link is below.`,
    published_at: '2026-11-30T10:00:00Z',
    updated_at: '2026-11-30T10:00:00Z',
    source_name: 'News18 (via Daily 8)',
    source_title: 'Family Surprises House Help With Air Cooler Ahead Of Summer, Viral Video Leaves Internet Teary-Eyed',
    source_date: '12 April 2026',
    source_url: 'https://www.daily8.com/en/article/b6f38cfac2cdffbcbd68953d307ae26a',
    editorial: true,
  },
];

/** The card shape. `body` is deliberately absent — a list never needs it. */
const REAL_STORY_CARDS = REAL_STORIES.map(({ body, ...card }) => card);

/** Reserved so a community submission can never collide with an editorial URL. */
const REAL_STORY_SLUGS = new Set(REAL_STORIES.map((s) => s.slug));

module.exports = { REAL_STORIES, REAL_STORY_CARDS, REAL_STORY_SLUGS };
