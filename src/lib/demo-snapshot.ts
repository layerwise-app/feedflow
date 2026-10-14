import { feedColor } from './reader-format.ts';
import { createEmptyReaderState } from './reader-state-utils.ts';
import type { ReaderSnapshotStory, ReaderState } from './reader-state-utils.ts';

type DemoItem = {
  feed: string;
  id: string;
  title: string;
  url: string;
  ageMinutes: number;
  excerpt: string;
  body: string;
  read?: boolean;
  starred?: boolean;
  saved?: boolean;
  note?: string;
  highlights?: string[];
};

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** An in-memory library for the demo reader and landing page. Nothing here is fetched or saved. */
export function createDemoState(now: number): ReaderState {
  const stories: ReaderSnapshotStory[] = DEMO_ITEMS.map((item, index) => {
    const feed = DEMO_FEEDS.find((candidate) => candidate.name === item.feed)!;
    const publishedAt = now - item.ageMinutes * 60_000;
    return {
      id: index + 1,
      source: item.feed,
      feedUrl: feed.url,
      feedItemId: item.id,
      initials: item.feed.slice(0, 1).toUpperCase(),
      color: feedColor(item.feed),
      title: item.title,
      excerpt: item.excerpt,
      body: item.body,
      time: dateFormat.format(new Date(publishedAt)),
      publishedAt,
      category: 'From feed',
      read: item.read ?? false,
      starred: item.starred ?? false,
      saved: item.saved ?? false,
      shared: false,
      image: 'garden',
      url: item.url,
      ...(item.note ? { note: item.note } : {}),
      ...(item.highlights ? { highlights: item.highlights } : {})
    };
  });

  return {
    ...createEmptyReaderState(),
    stories,
    feeds: DEMO_FEEDS.map((feed) => ({ ...feed, lastFetchedAt: now - 12 * 60_000 })),
    folders: ['Tech', 'Science', 'Design'],
    feedFolders: {
      'The Verge': 'Tech',
      "Simon Willison's Weblog": 'Tech',
      'Quanta Magazine': 'Science',
      NASA: 'Science',
      'Smashing Magazine': 'Design'
    },
    autoMarkRead: true
  };
}

// Real items from each feed, captured on 2026-10-14. Ages are relative so the demo always looks current.
const DEMO_FEEDS = [
  {
    "name": "The Verge",
    "url": "https://www.theverge.com/rss/index.xml"
  },
  {
    "name": "Simon Willison's Weblog",
    "url": "https://simonwillison.net/atom/everything/"
  },
  {
    "name": "Quanta Magazine",
    "url": "https://www.quantamagazine.org/feed/"
  },
  {
    "name": "NASA",
    "url": "https://www.nasa.gov/news-release/feed/"
  },
  {
    "name": "Smashing Magazine",
    "url": "https://www.smashingmagazine.com/feed/"
  },
  {
    "name": "kottke.org",
    "url": "https://feeds.kottke.org/main"
  }
];

const DEMO_ITEMS: DemoItem[] = [
  {
    "feed": "NASA",
    "id": "https://science.nasa.gov/image-article/apod-2026-october-14-mars-and-the-beehive-under-an-aurora/",
    "title": "APOD: 2026 October 14 – Mars and the Beehive Under an Aurora",
    "url": "https://science.nasa.gov/image-article/apod-2026-october-14-mars-and-the-beehive-under-an-aurora/",
    "ageMinutes": 395,
    "excerpt": "What a cosmic coincidence! In today’s image, Mars joins the Beehive cluster below an auroral curtain and above a horizon of happy little trees near Lansjärv, Sweden.",
    "body": "What a cosmic coincidence! In today’s image, Mars joins the Beehive cluster below an auroral curtain and above a horizon of happy little trees near Lansjärv, Sweden.",
    "starred": true
  },
  {
    "feed": "NASA",
    "id": "https://science.nasa.gov/earth/earth-observatory/hurricane-simon-lurks-off-the-mexican-coast/",
    "title": "Hurricane Simon Lurks Off the Mexican Coast",
    "url": "https://science.nasa.gov/earth/earth-observatory/hurricane-simon-lurks-off-the-mexican-coast/",
    "ageMinutes": 399,
    "excerpt": "Though it remained offshore, the storm lashed coastal areas with high winds and flooding—and produced remarkable rippling patterns in the upper atmosphere.",
    "body": "Though it remained offshore, the storm lashed coastal areas with high winds and flooding—and produced remarkable rippling patterns in the upper atmosphere."
  },
  {
    "feed": "kottke.org",
    "id": "tag:kottke.org,2026-10-13:49787",
    "title": "The first trailer for Greta Gerwig’s Narnia: The Magician’s Nephew",
    "url": "https://kottke.org/26/10/0049787-narnia-the-magicians-neph",
    "ageMinutes": 546,
    "excerpt": "The first trailer for Greta Gerwig’s Narnia: The Magician’s Nephew. I love Gerwig and I know this will be good, but I’m cautiously optimistic that it will be great. (I still forever have “Chronicwhatcles of Narnia”…",
    "body": "The first trailer for Greta Gerwig’s Narnia: The Magician’s Nephew. I love Gerwig and I know this will be good, but I’m cautiously optimistic that it will be great. (I still forever have “Chronicwhatcles of Narnia” stuck in my head tho…)"
  },
  {
    "feed": "Simon Willison's Weblog",
    "id": "https://simonwillison.net/2026/Oct/13/redesigning-source-control-at-anthropic/",
    "title": "Redesigning source control at Anthropic",
    "url": "https://simonwillison.net/2026/Oct/13/redesigning-source-control-at-anthropic/",
    "ageMinutes": 700,
    "excerpt": "Interesting piece from Anthropic describing why and how they built their own custom alternative to Git, based on the dramatic increase in rate of changes to their code after the past six months. In May 2026…",
    "body": "Interesting piece from Anthropic describing why and how they built their own custom alternative to Git, based on the dramatic increase in rate of changes to their code after the past six months.\n\nIn May 2026, Anthropic averaged around 2,500 code changes merged per day; as of September, we merged over 30,000 per day.\n\nThey included a chart showing those changes. I had Claude modify their chart (code here) to add markers for the public releases of each of their models in 2026:\n\nThis shows public release dates, not the date when models became available for Anthropic's internal use. My guess is that the introduction of Fable/Mythos class models is a key factor in the increased coding velocity.\n\n\"Antique\" is their new code review system. The source control system is called Scion, and sounds to me like a reinvention of centralized source control along the lines of Subversion. They had some pretty extreme requirements:\n\nThe history of our main branch alone is almost 100 GB, and a  compressed  working copy is over 25 GB. We perform on the order of 25 million code checkouts per day for CI, before counting developer environments, agent sandboxes, and research jobs. Fetched naively, that would be over 600 PB of git traffic per day.\n\nThe new system was built by a team of seven people, and the migration from Git was completed in five months.\n\nWhen asked on Hacker News about the lack of offline support, Scion engineer Nick G replied:\n\nSince Claude is by far the heaviest user of Scion and is necessarily online, this just wasn't important to do.",
    "saved": true,
    "note": "Compare with our monorepo checkout times before Thursday.",
    "highlights": [
      "In May 2026, Anthropic averaged around 2,500 code changes merged per day; as of September, we merged over 30,000 per day."
    ]
  },
  {
    "feed": "Simon Willison's Weblog",
    "id": "https://simonwillison.net/2026/Oct/13/llm-gemini/",
    "title": "llm-gemini 0.35",
    "url": "https://simonwillison.net/2026/Oct/13/llm-gemini/",
    "ageMinutes": 731,
    "excerpt": "I added support to llm-gemini for the new Gemini 4 Argon model, made available today via the Gemini API and for customers of their $100/month subscription plan. Here are the low, medium and high pelicans. As…",
    "body": "Release: llm-gemini 0.35\n\nI added support to llm-gemini for the new Gemini 4 Argon model, made available today via the Gemini API and for customers of their $100/month subscription plan.\n\nHere are the low, medium and high pelicans. As expected, they are all excellent: Gemini has a track record of producing great SVGs, and are the only lab where I know their staff have invested in SVG specifically (and who have boasted about their pelicans before.)\n\nHere's the \"high\" illustration, which cost me 17.166 cents:\n\nThe pricing is interesting. At launch, Argon is $2/million input and $10/million output - the same price as GPT-6 Sol, half the price of Claude Opus 5.5 and 1/5th the price of Claude Fable 5.1 and GPT-6 Astra.\n\nBut on December 1st Argon is set to double in price - so it will be the same price as Opus 5.5.\n\nPrices like this aren't really comparable these days since what really matters is how many tokens a model takes to achieve a goal within an agentic harness.\n\nOne useful clue for that comes from Artificial Analysis, who publish the total cost to run their benchmark using each model. Argon is looking very good there - costing $2,407 to run the benchmark, putting it close to GLM-5.3 and significantly cheaper than OpenAI, Anthropic, and Meta's latest models.\n\nWhen the price doubles it will still be a little cheaper than GPT-6 Astra.\n\n(I used ChatGPT to edit that chart ! The data is all correct, I checked - I needed to get that Gemini 4 Argon info box to display without overlapping the other numbers.)"
  },
  {
    "feed": "The Verge",
    "id": "https://www.theverge.com/?p=1010561",
    "title": "Apple’s HomeView ad is confusing to everyone except parents",
    "url": "https://www.theverge.com/tech/1010561/apple-homeview-commercial-reaction",
    "ageMinutes": 750,
    "excerpt": "Apple's ad introducing its new HomeView smart display is a little unusual. It's fast-paced and unruly, depicting a family of five as they rush through the morning routine. There's yelling and mess, misplaced keys…",
    "body": "Apple's ad introducing its new HomeView smart display is a little unusual. It's fast-paced and unruly, depicting a family of five as they rush through the morning routine. There's yelling and mess, misplaced keys and discarded eggshells. Apple's typical vibe is clean, simple, orderly; this commercial is chaos. But the spot has parents - those…",
    "read": true
  },
  {
    "feed": "NASA",
    "id": "https://www.nasa.gov/?post_type=press-release&p=1056041",
    "title": "NASA Names Astronaut Christina Koch Acting Deputy Chief Engineer",
    "url": "https://www.nasa.gov/news-release/nasa-names-astronaut-christina-koch-acting-deputy-chief-engineer/",
    "ageMinutes": 839,
    "excerpt": "NASA engineer and astronaut Christina Koch will serve as the agency’s acting deputy chief engineer beginning on Sunday, Nov. 1, following the retirement of Katherine Van Hooser, who will conclude more than 35 years…",
    "body": "NASA engineer and astronaut Christina Koch will serve as the agency’s acting deputy chief engineer beginning on Sunday, Nov. 1, following the retirement of Katherine Van Hooser, who will conclude more than 35 years of distinguished service to the agency on Wednesday, Oct. 21. In her new role, Koch will help lead NASA’s engineering community,…"
  },
  {
    "feed": "kottke.org",
    "id": "tag:kottke.org,2026-10-13:49785",
    "title": "So Many Different Mes",
    "url": "https://kottke.org/26/10/so-many-different-mes",
    "ageMinutes": 872,
    "excerpt": "Japanese photographer and artist Tomoko Sawada works primarily in self-portraiture. For her first project, she visited ID photo booths to take hundreds of photos of herself, dressed, posed, and presented…",
    "body": "Japanese photographer and artist Tomoko Sawada works primarily in self-portraiture. For her first project, she visited ID photo booths to take hundreds of photos of herself, dressed, posed, and presented differently. Eugenie Shin of Tokyo Weekender calls that 1998 project, ID 400, “a dizzying grid of strangers who are all actually the same woman”.\n\nFor subsequent projects, Sawada says she’s continued to “examine the relationship between outer appearance and inner self through different concepts”.\n\n(via tokyo weekender)\n\nTags: art · photography · Tomoko Sawada"
  },
  {
    "feed": "The Verge",
    "id": "https://www.theverge.com/?p=1010619",
    "title": "It looks like Apple Music is getting a new icon",
    "url": "https://www.theverge.com/tech/1010619/apple-music-new-icon-ios-27-beta",
    "ageMinutes": 875,
    "excerpt": "Apple Music's iconic red app icon has reportedly been replaced with a black-and-white version in the latest iOS 27.2 beta, 9to5Mac reports. The eighth note on the icon also appears to have a slightly sharper angle…",
    "body": "Apple Music's iconic red app icon has reportedly been replaced with a black-and-white version in the latest iOS 27.2 beta, 9to5Mac reports. The eighth note on the icon also appears to have a slightly sharper angle than the original. A new Apple Music logo was also spotted last month on the Apple Music Hall website,…"
  },
  {
    "feed": "The Verge",
    "id": "https://www.theverge.com/?p=1010365",
    "title": "Shopify opens its catalog up to more AI agents",
    "url": "https://www.theverge.com/news/1010365/shopify-opens-its-catalog-up-to-more-ai-agents",
    "ageMinutes": 897,
    "excerpt": "More AI agents will soon be able to browse and purchase from Shopify listings, marking an expansion of the company's agentic commerce ambitions. Shopify announced Tuesday it will let shoppers configure their AI…",
    "body": "More AI agents will soon be able to browse and purchase from Shopify listings, marking an expansion of the company's agentic commerce ambitions. Shopify announced Tuesday it will let shoppers configure their AI agents to purchase products on their behalf, giving more agents access to over a billion listings in Shopify's catalog. (The catalog consists…"
  },
  {
    "feed": "The Verge",
    "id": "https://www.theverge.com/?p=1010406",
    "title": "Xbox is officially embracing the chaos of AI-powered game ports",
    "url": "https://www.theverge.com/news/1010406/xbox-labs-game-decompiling-emulation-exploration",
    "ageMinutes": 939,
    "excerpt": "Retro gaming is going through a wild time at the moment, thanks to decompilations and recompilations that are letting gamers port classic titles to new devices, or merge code from two different games into a single…",
    "body": "Retro gaming is going through a wild time at the moment, thanks to decompilations and recompilations that are letting gamers port classic titles to new devices, or merge code from two different games into a single new experience. Microsoft has witnessed skateboarding being modded into Call of Duty and Halo being played in a web…"
  },
  {
    "feed": "NASA",
    "id": "https://science.nasa.gov/photojournal/comparing-off-world-rover-driving-distances/",
    "title": "Comparing Off-World Rover Driving Distances",
    "url": "https://science.nasa.gov/photojournal/comparing-off-world-rover-driving-distances/",
    "ageMinutes": 1004,
    "excerpt": "This infographic illustrates the distances driven by various rovers on the surface of Earth’s Moon and Mars. Of the vehicles shown, the NASA Mars rovers Perseverance and Curiosity are still operational and moving…",
    "body": "This infographic illustrates the distances driven by various rovers on the surface of Earth’s Moon and Mars. Of the vehicles shown, the NASA Mars rovers Perseverance and Curiosity are still operational and moving across the surface; the figures shown for those two are distances driven as of Oct. 11, 2026. As of that date,…",
    "read": true,
    "starred": true
  },
  {
    "feed": "NASA",
    "id": "https://science.nasa.gov/photojournal/nasas-record-setting-perseverance-rover-team/",
    "title": "NASA’s Record-Setting Perseverance Rover Team",
    "url": "https://science.nasa.gov/photojournal/nasas-record-setting-perseverance-rover-team/",
    "ageMinutes": 1011,
    "excerpt": "Members of NASA’s Perseverance Mars mission team gather in the Mars Yard at the agency’s Jet Propulsion Laboratory in Southern California with a certificate from Guinness World Records marking the rover distance…",
    "body": "Members of NASA’s Perseverance Mars mission team gather in the Mars Yard at the agency’s Jet Propulsion Laboratory in Southern California with a certificate from Guinness World Records marking the rover distance record on the Red Planet. Positioned in front of the team is OPTIMISM (Operational Perseverance Twin for Integration of Mechanisms and Instruments…"
  },
  {
    "feed": "Simon Willison's Weblog",
    "id": "https://simonwillison.net/2026/Oct/13/geoffrey-huntley/",
    "title": "Quoting Geoffrey Huntley",
    "url": "https://simonwillison.net/2026/Oct/13/geoffrey-huntley/",
    "ageMinutes": 1268,
    "excerpt": "If the agent isn't using my diagnostics library, I could introspect and update AGENTS.md, but there's still a delta, and it'll drift. Instead, I write a pre-commit hook that checks the git diff for direct calls to…",
    "body": "If the agent isn't using my diagnostics library, I could introspect and update AGENTS.md, but there's still a delta, and it'll drift. Instead, I write a pre-commit hook that checks the git diff for direct calls to observability modules that bypass my diagnostics module. Boom: fail the commit, inject a prompt telling the agent to use the diagnostics library. All of a sudden it's ten out of ten.\n\n— Geoffrey Huntley, nobody should type code by hand anymore. here's what's left.\n\nTags: coding-agents, generative-ai, git, agentic-engineering, ai, geoffrey-huntley, llms"
  },
  {
    "feed": "Simon Willison's Weblog",
    "id": "https://simonwillison.net/2026/Oct/12/llm-meta-ai/",
    "title": "llm-meta-ai 0.2",
    "url": "https://simonwillison.net/2026/Oct/12/llm-meta-ai/",
    "ageMinutes": 2081,
    "excerpt": "Meta AI release Muse Wonder (and Muse Wonder Full), their new \"most capable models\". These look like they may be Meta's first Fable class models - Artificial Analysis scores Muse Wonder (Max) as equivalent to…",
    "body": "Release: llm-meta-ai 0.2\n\nMeta AI release Muse Wonder (and Muse Wonder Full), their new \"most capable models\". These look like they may be Meta's first Fable class models - Artificial Analysis scores Muse Wonder (Max) as equivalent to GPT-6.1 Sol.\n\nI updated my llm-meta-ai plugin for the new model. Here are pelicans for Muse Wonder for the six reasoning levels: minimal, low, medium, high, xhigh, max. This is the max one:\n\nFor comparison, here are pelicans for Muse 1.3 (released September 2nd) and Muse 1.2 (released August 5th). Meta AI are putting out a new model a month, and the improvements between each model (at least in terms of drawing pelicans) are material.\n\nTags: ai, generative-ai, llms, meta, pelican-riding-a-bicycle, llm-release",
    "read": true
  },
  {
    "feed": "Quanta Magazine",
    "id": "https://www.quantamagazine.org/?p=167776",
    "title": "Is ‘Attention’ the Essence of Intelligence?",
    "url": "https://www.quantamagazine.org/is-attention-the-essence-of-intelligence-20261012/",
    "ageMinutes": 2660,
    "excerpt": "A mathematical mechanism enables AI models to process language at scale, undergirding the current AI revolution. Our columnist asks: Why is attention the key?",
    "body": "A mathematical mechanism enables AI models to process language at scale, undergirding the current AI revolution. Our columnist asks: Why is attention the key?"
  },
  {
    "feed": "Quanta Magazine",
    "id": "https://www.quantamagazine.org/?p=167729",
    "title": "How Does Life Unfold? A Landscape Metaphor Comes Into Its Own.",
    "url": "https://www.quantamagazine.org/how-does-life-unfold-a-landscape-metaphor-comes-into-its-own-20261009/",
    "ageMinutes": 6997,
    "excerpt": "C.H. Waddington’s powerful image of embryonic stem cells specializing on a rolling landscape has captivated biologists since the 1950s. Experimental data is finally confirming, and complicating, his visionary ideas.",
    "body": "C.H. Waddington’s powerful image of embryonic stem cells specializing on a rolling landscape has captivated biologists since the 1950s. Experimental data is finally confirming, and complicating, his visionary ideas."
  },
  {
    "feed": "Quanta Magazine",
    "id": "https://www.quantamagazine.org/?p=167663",
    "title": "As AI Closed In on ‘Unique Games’ Proof, Researchers Raced to Beat the Machines",
    "url": "https://www.quantamagazine.org/as-ai-closed-in-on-unique-games-proof-researchers-raced-to-beat-the-machines-20261007/",
    "ageMinutes": 9811,
    "excerpt": "In the shadow of a rumored AI proof of one of the biggest problems in their field, three computer scientists rushed to publish their own milestone result.",
    "body": "In the shadow of a rumored AI proof of one of the biggest problems in their field, three computer scientists rushed to publish their own milestone result."
  },
  {
    "feed": "Smashing Magazine",
    "id": "https://smashingmagazine.com/2026/10/how-name-things/",
    "title": "A Practical Guide To Naming Things",
    "url": "https://smashingmagazine.com/2026/10/how-name-things/",
    "ageMinutes": 11560,
    "excerpt": "A practical guide to naming UI components, with useful resources, naming conventions, and structures. You’ll find more useful guides and online workshops here on Smashing Magazine, so make sure to browse and explore.",
    "body": "A practical guide to naming UI components, with useful resources, naming conventions, and structures. You’ll find more useful guides and online workshops here on Smashing Magazine, so make sure to browse and explore.",
    "saved": true
  },
  {
    "feed": "Quanta Magazine",
    "id": "https://www.quantamagazine.org/?p=167602",
    "title": "Is AI the End of Math As We Know It?",
    "url": "https://www.quantamagazine.org/is-ai-the-end-of-math-as-we-know-it-20261005/",
    "ageMinutes": 12780,
    "excerpt": "Mathematicians are facing the sudden shift with grief, anger, and a desperate search for fresh ideas: “If we don’t adapt, there’s just no more math in 50 years.”",
    "body": "Mathematicians are facing the sudden shift with grief, anger, and a desperate search for fresh ideas: “If we don’t adapt, there’s just no more math in 50 years.”",
    "starred": true
  },
  {
    "feed": "Quanta Magazine",
    "id": "https://www.quantamagazine.org/?p=167558",
    "title": "Sea Monkeys Show Scientists How To Rewrite a Rule of Turbulence",
    "url": "https://www.quantamagazine.org/sea-monkeys-show-scientists-how-to-rewrite-a-rule-of-turbulence-20261002/",
    "ageMinutes": 17035,
    "excerpt": "Scientists assumed that energy flows in only one direction in a turbulent system. What they didn’t know, until they looked closely at brine shrimp, was that a simple factor can reverse the flow.",
    "body": "Scientists assumed that energy flows in only one direction in a turbulent system. What they didn’t know, until they looked closely at brine shrimp, was that a simple factor can reverse the flow.",
    "read": true
  },
  {
    "feed": "Smashing Magazine",
    "id": "https://smashingmagazine.com/2026/09/desktop-wallpaper-calendars-october-2026/",
    "title": "Under Autumn’s Spell (October 2026 Wallpapers Edition)",
    "url": "https://smashingmagazine.com/2026/09/desktop-wallpaper-calendars-october-2026/",
    "ageMinutes": 19990,
    "excerpt": "October is just around the corner, which means it’s time for some new desktop wallpapers! Designed by the community for the community, they’re here to brighten your screens, and maybe spark some creativity along the way.",
    "body": "October is just around the corner, which means it’s time for some new desktop wallpapers! Designed by the community for the community, they’re here to brighten your screens, and maybe spark some creativity along the way.",
    "read": true
  },
  {
    "feed": "Smashing Magazine",
    "id": "https://smashingmagazine.com/2026/09/stop-treating-css-container-queries-traditional-media-queries/",
    "title": "Stop Treating CSS Container Queries Like Traditional Media Queries",
    "url": "https://smashingmagazine.com/2026/09/stop-treating-css-container-queries-traditional-media-queries/",
    "ageMinutes": 40180,
    "excerpt": "Despite broad browser support, container queries remain surprisingly underused and frequently misunderstood. Let’s look at how they differ from media queries, when to reach for each, and how container queries help…",
    "body": "Despite broad browser support, container queries remain surprisingly underused and frequently misunderstood. Let’s look at how they differ from media queries, when to reach for each, and how container queries help reusable components respond naturally to the contexts in which they appear."
  },
  {
    "feed": "Smashing Magazine",
    "id": "https://smashingmagazine.com/2026/09/building-ux-roi-case-survives-boardroom/",
    "title": "Building A UX ROI Case That Survives The Boardroom",
    "url": "https://smashingmagazine.com/2026/09/building-ux-roi-case-survives-boardroom/",
    "ageMinutes": 47380,
    "excerpt": "Strong UX ideas do not secure investment on their own. Through a worked example, Alex Williams breaks down how to define business value, calculate costs, test causality, and build a credible case for the return on a…",
    "body": "Strong UX ideas do not secure investment on their own. Through a worked example, Alex Williams breaks down how to define business value, calculate costs, test causality, and build a credible case for the return on a design initiative.",
    "read": true
  },
  {
    "feed": "Smashing Magazine",
    "id": "https://smashingmagazine.com/2026/09/death-button-why-best-interface-is-no-interface/",
    "title": "The Death Of The Button: Why The Best Interface Is No Interface",
    "url": "https://smashingmagazine.com/2026/09/death-button-why-best-interface-is-no-interface/",
    "ageMinutes": 50440,
    "excerpt": "The web is evolving beyond menus, forms, and endless clicks toward experiences shaped around human intent. For UX designers, understanding this shift means re-evaluating their role, moving from designing visible…",
    "body": "The web is evolving beyond menus, forms, and endless clicks toward experiences shaped around human intent. For UX designers, understanding this shift means re-evaluating their role, moving from designing visible interfaces to guiding transparent, intent-driven AI experiences."
  }
];
