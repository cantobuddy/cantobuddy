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
];

/** The card shape. `body` is deliberately absent — a list never needs it. */
const REAL_STORY_CARDS = REAL_STORIES.map(({ body, ...card }) => card);

/** Reserved so a community submission can never collide with an editorial URL. */
const REAL_STORY_SLUGS = new Set(REAL_STORIES.map((s) => s.slug));

module.exports = { REAL_STORIES, REAL_STORY_CARDS, REAL_STORY_SLUGS };
