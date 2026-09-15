# Visitor search-intent report

Date: 2026-09-14. Window: PostHog events from 2026-06-16 to 2026-09-14 (90 days); the
Supabase miss log from 2026-08-03 to 2026-09-02 (its full contents). Analysis only, no
application changes. This report feeds the unified-search design and the content roadmap.

Every number is labelled with its source: **[PH]** = PostHog, **[SB]** = Supabase,
**[YT]** = the channel's uploads playlist, **[repo]** = static data in this repository.

## 1. Summary

1. Visitors search the site about 60 times a day. Most of that is in-page search on five
   archive pages, not the palette. The palette (`OmniSearch.vue`, live since 2026-08-02)
   takes about 6 opens a day. The chat takes about 2 messages a day.
2. The dominant intent is **lookup by identity**: a year, a model or trim, a paint code, a
   wheel brand, a fastener name. How-to intent shows up in the palette and the chat, not
   in the in-page search boxes.
3. **Zero-result rates are high everywhere except wheels.** On the wiring-diagram page
   68% of final queries return nothing. On torque it is 57%, colours 55%, documents 52%,
   wheels 10%.
4. Most palette misses are not missing content. Of 113 distinct palette queries that missed,
   42 (74 weighted) point at content the site already has but does not index: the parts
   archive (10,073 published parts), the YouTube catalogue (466 videos), the supplier
   directory, and the 3D model library. A further 21 are synonym or matching gaps in
   content that is indexed.
5. The real content gaps are: MPI-era (1997–2000) wiring diagrams, fuel-injection fuse and
   relay guidance, casting-number identification (12G940 and friends), and torque rows for
   cooling, dampers and pedal box.
6. The chat is used for procedures, tuning choices and buying advice. Search is used for
   identification and specs. There is little overlap, which argues for routing rather than
   merging.
7. Non-English visitors are about a fifth of searchers, but they type English. Only about
   4% of query text is in another language.

## 2. Data sources and caveats

| Source                                                                                         | What it holds                                                                                                   | Coverage                                       | Caveat                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `archive_search_misses` [SB]                                                                   | Zero-result palette queries with a miss counter                                                                 | 287 rows, 368 misses, 2026-08-03 to 2026-09-02 | Records on a 180 ms debounce, so most rows are keystroke prefixes. Collapsed to 86 final queries (132 misses). No row was promoted or dismissed.                        |
| `search_performed` [PH]                                                                        | In-page search on electrical, colours, wheels, torque, documents, registry, clearance, weights, parts, exchange | 5,272 events, 829 people                       | Also fires per keystroke. Collapsed to about 950 final queries per person per day. `results_count` is the count for that query.                                         |
| `omnisearch_opened`, `omnisearch_result_selected`, `omnisearch_view_all` [PH]                  | Palette funnel; `view_all` carries the query and result count; `result_selected` carries surface and URL        | 377 opens, 109 clicks, 76 view-all             | Only `view_all` carries query text. A click does not record what was typed.                                                                                             |
| `no_results_shown` [PH]                                                                        | Exchange listings filter with no matches                                                                        | 57 events                                      | 44 of 57 had no text query (filter-only).                                                                                                                               |
| `chat_message_sent`, `floating_chat_submitted`, `chat_starter_used`, `chat_run_completed` [PH] | Chat volume, message length, starter prompt text, server-side run outcome                                       | 184 + 33 + 20 messages; 243 runs               | No event carries free-text chat messages. `chat_run_completed` began on 2026-08-31 and its first two days include a burst from one distinct id that looks like testing. |
| `chat_threads` [SB]                                                                            | Synced conversations for Sustaining Members                                                                     | 2 threads, 4 messages, 1 account               | Too small to analyse. Both user messages quoted below; neither contains personal data.                                                                                  |
| `archive_requests` (Most Wanted) [SB]                                                          | Community requests                                                                                              | 0 rows                                         | The request loop has not been used yet.                                                                                                                                 |
| `relative_needle_search` [PH]                                                                  | Needle comparison tool                                                                                          | 10,315 events, 1,735 people                    | Structured, not free text. Included for context only.                                                                                                                   |
| YouTube uploads playlist [YT]                                                                  | Video titles                                                                                                    | 466 videos                                     | Title match only, as `server/utils/youtubeCatalog.ts` does.                                                                                                             |

Two coverage notes.

- The miss log's last row is 2026-09-02 00:14 UTC. PostHog shows 26 zero-result
  `omnisearch_view_all` events after that date. The two sources should agree, so the log's
  coverage after 2026-09-02 needs to be verified before it is used for Most Wanted.
- One miss-log query was a personal name. It is excluded from every table here.

## 3. Volume

### 3.1 Per week [PH]

Event counts, not collapsed. Divide in-page events by about 5.5 for final queries.

| Week of              | In-page search events | People | Palette opens | Palette clicks | View all | Chat messages | Chat people | Floating chat | Needle tool |
| -------------------- | --------------------: | -----: | ------------: | -------------: | -------: | ------------: | ----------: | ------------: | ----------: |
| 2026-06-15           |                   362 |     56 |             – |              – |        – |            13 |           7 |             2 |         393 |
| 2026-06-22           |                   267 |     47 |             – |              – |        – |             7 |           6 |             3 |         711 |
| 2026-06-29           |                   369 |     45 |             – |              – |        – |             1 |           1 |             1 |       1,083 |
| 2026-07-06           |                   395 |     57 |             – |              – |        – |             6 |           5 |             3 |         904 |
| 2026-07-13           |                   551 |     83 |             – |              – |        – |             6 |           5 |             3 |         751 |
| 2026-07-20           |                   412 |     77 |             – |              – |        – |             7 |           6 |             3 |         936 |
| 2026-07-27           |                   472 |     74 |            12 |              3 |        0 |            18 |           9 |             9 |         901 |
| 2026-08-03           |                   273 |     61 |            93 |             24 |       12 |             8 |           7 |             2 |         913 |
| 2026-08-10           |                   577 |     82 |            58 |             17 |        7 |             5 |           5 |             3 |         651 |
| 2026-08-17           |                   406 |     64 |            67 |             12 |       12 |             5 |           4 |             2 |         697 |
| 2026-08-24           |                   424 |     52 |            37 |             16 |       11 |            16 |          14 |             0 |         732 |
| 2026-08-31           |                   195 |     56 |            58 |             18 |       14 |            60 |          24 |             0 |         347 |
| 2026-09-07           |                   517 |     62 |            60 |             21 |       19 |            23 |           7 |             2 |       1,123 |
| 2026-09-14 (partial) |                    54 |     18 |             3 |              0 |        1 |             9 |           4 |             0 |         173 |

The chat spike in the week of 2026-08-31 follows the in-Worker agent release and the new
starter prompts (20 starter clicks, all after 2026-08-25).

### 3.2 Rates

| Metric                                                                      | Value                                           | Source                      |
| --------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------- |
| Palette open to result click                                                | 109 / 377 = 29%                                 | [PH]                        |
| Palette open to view-all                                                    | 76 / 377 = 20%                                  | [PH]                        |
| Palette open to any action                                                  | 49%                                             | [PH]                        |
| Palette view-all with zero results                                          | 56 / 76 = 74%                                   | [PH]                        |
| Palette opens with at least one zero-result state, 2026-08-03 to 2026-09-02 | about 132 / 300 = 44%                           | [SB] misses over [PH] opens |
| In-page final queries with zero results, all surfaces                       | about 470 / 950 = 49%                           | [PH]                        |
| Chat messages per conversation                                              | 184 / 108 first messages = 1.7                  | [PH]                        |
| Chat runs that called a tool                                                | about 60% (excluding the 2026-09-01 test burst) | [PH]                        |
| Chat quota limit reached                                                    | 10 events, 6 people                             | [PH]                        |

### 3.3 In-page search by surface [PH]

| Surface                      | Events | People |   Final queries | Final queries with zero results |         Zero rate |
| ---------------------------- | -----: | -----: | --------------: | ------------------------------: | ----------------: |
| Electrical (wiring diagrams) |  2,001 |    148 |             218 |                             148 |               68% |
| Colours                      |    756 |    173 |             165 |                              90 |               55% |
| Wheels                       |    594 |     99 |             144 |                              15 |               10% |
| Torque (all tables)          |  1,155 |    128 |             245 |                             140 |               57% |
| Documents                    |    424 |     82 |             141 |                              74 |               52% |
| Exchange listings            |    201 |     95 | 22 text queries |                              14 |               64% |
| Registry                     |     89 |     21 |              26 |                              20 |               77% |
| Clearances                   |     24 |      9 |              13 |                              12 |               92% |
| Parts archive                |     14 |      3 |               3 |                               3 |              100% |
| Weights                      |      6 |      3 |               5 |                               4 |               80% |
| Home hero bar                |     10 |     10 |              10 |                             n/a | opens the palette |

The wheel library is the one surface that works. Its data has the fields people search
for (brand, name, size). Every other surface is searched for something its data does not
carry in the searched field: a year on the diagram page, a code on the colour page, a
model on the documents page.

## 4. Themes

### 4.1 In-page search, by surface and sub-theme [PH]

Sub-themes were assigned by regular expression over the collapsed final queries. Counts
are approximate. Examples are verbatim, lower-cased.

**Electrical (218 final queries)**

| Sub-theme                    | Queries | Zero | Examples                                                                                                                                             |
| ---------------------------- | ------: | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model or trim name           |      50 |   26 | `morris mini k`, `mini 1000`, `mini cooper one`, `998`, `mayfair`, `mk3`, `mpi`                                                                      |
| Year plus model              |      48 |   41 | `mayfair 1989`, `61 morris mini cooper`, `1991 classic mini instruments`, `mini 1991`, `1994 rover mini`                                             |
| Circuit or component         |      43 |   32 | `mini interior light diagram`, `coil ignition diagram`, `loom`, `air conditioner ecu`, `charcoal canister`, `fuel pump`, `mems relay`, `cobra alarm` |
| Bare year                    |      17 |    9 | `1978` (14 people), `1985`, `1986`, `1989`, `1992`, `1993`                                                                                           |
| Modern BMW MINI or other car |      22 |   16 | `mini 2005`, `2010 mini cooper clubman s`, `r56`, `n12`, `vw passat b5`                                                                              |
| Non-Latin or non-English     |       6 |    6 | `schaltpläne der klassischen mk iv`, `97年ecu配線図`, `ローバーmi`                                                                                   |
| Other or truncated           |      32 |   18 | `engine`, `t55`, `diy`                                                                                                                               |

**Torque (245 final queries)**

| Sub-theme                       | Queries | Zero | Examples                                                                                                      |
| ------------------------------- | ------: | ---: | ------------------------------------------------------------------------------------------------------------- |
| Engine, gearbox and cooling     |      73 |   28 | `head`, `rocker`, `timing`, `oil`, `thermostat`, `sump`, `fan`, `radiator`, `1275`, `sensor`                  |
| Suspension, steering and brakes |      47 |   27 | `ball joint`, `tie rod`, `subframe`, `tower`, `lower arm`, `caliper`, `shock`, `pedal`, `u bolts`             |
| Wheels, hubs and driveshafts    |      25 |   12 | `wheel` (16 people), `hub`, `wheel nut torque`, `lugnut torque`, `front wheel bearings`, `drive shaft flange` |
| Other or truncated              |     100 |   73 | `nm`, `nut`, `1071`, `clutcj`, `brakr`, `cool`                                                                |

**Colours (165 final queries)**

| Sub-theme                     | Queries | Zero | Examples                                                                                                                                           |
| ----------------------------- | ------: | ---: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named colour, including typos |      96 |   57 | `surf blue`, `island blue`, `clipper blue`, `old english white`, `primrose yellow` (9 spellings), `cotswold yellow`, `harvest gold`, `post office` |
| Paint code lookup             |      53 |   31 | `cne`, `rbk`, `rwv`, `gr34`, `7099m`, `blvc1230`, `blvc61`, `jrj`, `caq`                                                                           |
| Single generic colour word    |      16 |    2 | `blue` (27 people), `red` (27), `green`, `white`, `yellow`, `black`, `grey`                                                                        |

**Documents (141 final queries)**

| Sub-theme                     | Queries | Zero | Examples                                                                                                                    |
| ----------------------------- | ------: | ---: | --------------------------------------------------------------------------------------------------------------------------- |
| Model, marque or trim         |      83 |   44 | `rover mini`, `cooper s`, `mini van`, `austin mini mk3`, `morris mini truck`, `traveller`, `innocenti`, `mayfair`, `mini k` |
| Year, with or without model   |      30 |   12 | `1960`, `1964`, `1979 mini moke`, `1996-2001 manual`, `1966 cooper`                                                         |
| Topic or procedure            |      21 |   13 | `wiring diagram`, `restoration`, `steering alignment`, `exhaust`, `weber`, `a/c`, `cylinder head nut tightening sequence`   |
| Publication or part-list code |       7 |    5 | `adk3502`, `akd4935b`, `akm7169`, `rcl0225eng`, `h1f38`                                                                     |

**Wheels (144 final queries)**

| Sub-theme      | Queries | Zero | Examples                                                                                            |
| -------------- | ------: | ---: | --------------------------------------------------------------------------------------------------- |
| Brand or name  |     122 |    8 | `minilite`, `cosmic`, `mamba`, `momo`, `oz`, `jbw`, `gb`, `dunlop`, `rostyle`, `weller`, `watanabe` |
| Size or offset |      22 |    7 | `4.5`, `5.5`, `10x5`, `13x7`, `et35`, `10” 5inch`                                                   |

**Exchange listings (22 text queries)**: `engine`, `body panels`, `doors`, `seats`,
`interior`, `bonnet`, `fuel`, `roof rack brackets`, `engine stand adapter`, `1275`, two
country names, and three tabletop-wargame terms that are off-topic.

**Registry (26 queries)**: 20 are bare years or registration-plate shapes, 20 returned
nothing. **Clearances (13)**: `big end`, `conrod`, `main`, `998`, `head`; 12 returned
nothing.

### 4.2 Palette queries [SB] + [PH]

113 distinct queries that returned zero results (86 from the miss log, 27 more from
`omnisearch_view_all`), hand-classified. Weight = miss count or view-all count.

| Theme                   | Queries | Weighted | Examples                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------: | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How-to / repair         |      51 |       70 | `brake cylinder install`, `brake bleeding`, `engine removal`, `clutch removal`, `oil drain plug`, `half moon seals`, `steering drop bracket`, `rubber cone`, `bonnet latch`, `glovebox latch`, `seat belt`, `wheel arch` / `flare` (5), `pedal`, `roof rack`, `spot light bracket`, `c pillar`, `window stay` |
| Electrical / wiring     |      12 |       22 | `injector fuse` (6), `rear light bulb` (3), `voltage gauge` (2), `fan kit`, `crank sensor`, `mini 1000cc 1980 wiring`                                                                                                                                                                                         |
| Tuning / ECU / carbs    |       8 |       18 | `haltech` (5), `comp ratio` (3), `fuel injection` (3), `bdl` (2), `map` (2), `bore strok`, `twin su`                                                                                                                                                                                                          |
| Identification          |      10 |       17 | `mini 1000cc 1980` (8), `xc2s1n1056418b`, `vin`, `ado16`, `mini classic cabrio`, `moke`, `d series`                                                                                                                                                                                                           |
| Part number             |       7 |       10 | `12g940` (2), `12m3412` (2), `pd16` (2), `12hd16`, `12041897`, `12ye/a/h3861`                                                                                                                                                                                                                                 |
| Off-topic or unreadable |      10 |       10 | `rhea`, `warung`, `galf`, `dyf`, `soar`                                                                                                                                                                                                                                                                       |
| Buying / vendors        |       7 |        9 | `bagsport` (3), `dunlop alloy wheel`, `ultimate stainless steel line kit`, `kad`                                                                                                                                                                                                                              |
| Channel / community     |       4 |        9 | `bad wolf` (5), `giveaway` (2), `podcast`                                                                                                                                                                                                                                                                     |
| Torque / specs          |       4 |        5 | `1st motion nut torque` (2), `transmission main nut torque`, `lugnut torque`                                                                                                                                                                                                                                  |

What visitors clicked when the palette did find something (109 clicks): wheels 35, tools 29
(needles 10, torque 6, gearing 4, engine decoder 2, clearance 2, alignment 2), archive 25
(wiring diagrams 10, documents 6, colours 3), exchange 15, 3D models 7.

### 4.3 Chat [PH] + [SB]

No PostHog event carries free-text chat. The evidence is the starter prompts, message
length, tool use, and two stored member messages.

| Starter prompt clicked                                        | Count |
| ------------------------------------------------------------- | ----: |
| What are the cylinder head torque settings on an A-series?    |     9 |
| Which SU needle suits a 1275 with an HIF44? (en, de, it)      |     7 |
| What final drive should I run for motorway cruising? (en, es) |     3 |
| Decode the chassis number XN2S1N123456                        |     1 |

The two stored member messages, both free of personal data:

- "What are the cylinder head torque settings on an A-series?"
- "Whats the best place to buy a rocker cover"

Other chat signals: average message length 64 characters on `/chat`, 57 on the home
floating input; 16 of 184 messages were over 120 characters; 108 of 184 were the first
message of a conversation; about 60% of completed runs called at least one tool;
`membership_mentioned` fired on 4 runs; `upstream_error` on 3.

## 5. Does the site have it, and did search find it?

Gap classes for the 113 palette misses:

| Class                            | Queries | Weighted | Meaning                                                                                                           |
| -------------------------------- | ------: | -------: | ----------------------------------------------------------------------------------------------------------------- |
| Content exists, not indexed      |      42 |       74 | The answer is in the parts archive, a video, the supplier list, or a 3D model. The palette does not search those. |
| Genuinely missing                |      22 |       34 | No page, video or row answers it.                                                                                 |
| Synonym or matching gap          |      21 |       33 | Indexed content exists but the matcher does not connect the words.                                                |
| Had results (view-all with hits) |      13 |       14 | Not a miss.                                                                                                       |
| Off-topic                        |       8 |        8 | Not a Mini question.                                                                                              |
| Typo                             |       7 |        7 | Fuzzy matching would recover it.                                                                                  |

Per theme:

| Theme                | Site has content?                                          | Did search find it? | Why not                                                                                                                                           |
| -------------------- | ---------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| How-to / repair      | Mostly, as videos (see §6) and parts                       | No                  | `runOmnisearch` covers tools, wiring diagrams, archive sections, and the Postgres `omnisearch()` surfaces. Videos and parts are outside it.       |
| Electrical / wiring  | Yes for 1959–1996; no for MPI 1997–2000                    | Rarely              | Diagram search matches names only. Years live in `from`/`to`; trims like Mayfair, City, Special are not in the names.                             |
| Tuning / ECU / carbs | Videos, the needle tool, the compression tool              | No                  | `comp ratio` does not match `compression` under the substring rule. Needle codes are not detected. Haltech content is video-only.                 |
| Identification       | Chassis and engine decoders, registry                      | No                  | The palette does not recognise a chassis-number shape. `mini 1000cc 1980` has no diagram name to match.                                           |
| Part number          | 10,073 parts in the archive; these specific numbers absent | No                  | Parts archive not in the palette; casting numbers (12G940) are not part numbers in the ingest sources.                                            |
| Torque / specs       | Yes                                                        | No                  | Per-table search; `wheel nut torque` fails on the word `torque`; `1st` vs `First`; `lugnut` vs `Wheel Nuts`; `sump` vs `Transmission Drain Plug`. |
| Colours              | Yes                                                        | Half the time       | Codes and no-space typos miss.                                                                                                                    |
| Documents            | Yes                                                        | Half the time       | Model and year are not searchable fields.                                                                                                         |
| Buying / vendors     | `/archive/suppliers` exists                                | No                  | Not in the palette.                                                                                                                               |
| Channel / community  | Videos and series exist                                    | No                  | Not in the palette.                                                                                                                               |

## 6. Videos that would have answered the how-to misses [YT]

Title match against the uploads playlist. Every row below is a palette miss or a
zero-result in-page query that a video already covers.

| Query                        | Matching video (year)                                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| brake bleeding               | How to Bleed Your Brakes (2016); Eezibleed Your Classic Mini's Brakes (2018)                                                                                    |
| brake cylinder install       | Replacing Rear Wheel Brake Cylinders (2018); Odd Jobs: Master Cylinder, Clutch, and Carb (2019)                                                                 |
| clutch removal               | How to Replace your Clutch without Removing your Engine (2018); Pre-Verto Clutch Release Bearing Replacement (2016); The CMDIY RTS Clutch (2024)                |
| engine removal               | Engine Removal Timelapse (2015)                                                                                                                                 |
| remove gearbox               | Learn how to rebuild a classic mini gearbox (2022); Why Stock Mini Gearboxes Fail, Part 1 (2026)                                                                |
| oil drain plug, engine oil   | Back to the Basics: Classic Mini Oil Change (2022)                                                                                                              |
| radiator                     | Radiator Removal and Replacement (2017); Radiator Flush and Thermostat Replacement (2015)                                                                       |
| thermostat, coolant temp     | Radiator Flush and Thermostat Replacement (2015); Waterless Coolant Conversion (2017)                                                                           |
| fan, fan kit                 | I Built a Custom Shroud and Electric Fan for My Classic Mini (2026)                                                                                             |
| steering drop bracket        | Installing a Steering Drop Bracket (2020)                                                                                                                       |
| rubber cone, front end       | How To Replace Suspension Cones (2023); Ditching Springs and Back to Cones (2025); How to Grease your Suspension (2016)                                         |
| rotation jig, engine plate   | The DIY Engine Stand Plate (2025); Custom A-Series Engine Stand Mount (2022)                                                                                    |
| wiring loom, ignition wiring | Building a Custom Wiring Harness, Parts 1 and 2 (2023)                                                                                                          |
| haltech, map, fuel injection | Free Classic Mini ECU Map (2022); The Future of Classic Minis: Bolt on Fuel Injection (2022); Trip to Haltech USA to Tune my Mini (2025); Wiring the ECU (2021) |
| voltage gauge                | How to Replace a Classic Mini Voltage Stabilizer (2020); Haltech-powered Smiths Gauges (2023)                                                                   |
| alternator                   | How to Install a Lightweight Racing Alternator (2020)                                                                                                           |
| cv joint oil seal            | Repairing or Servicing Your Driveshaft (2018); Putting a Driveshaft back together (2018)                                                                        |
| hub, front wheel bearings    | Front Drum Wheel Bearings (2020); Rear Wheel Bearing Replacement (2016)                                                                                         |
| manifold                     | How to Fix an Exhaust Leak (2017); Exhaust Replacement RC40 vs Maniflow (2017)                                                                                  |
| pedal                        | Bolt in Drive by Wire Pedal (2024); DSN Retrosport Pedal Installation (2019)                                                                                    |
| sensor, crank sensor         | How to Install a Trigger Position Sensor (2023); This $40 Sensor Modernizes Your Classic Mini (2026)                                                            |
| timing, distributor          | Ignition and Timing in a Classic Mini (2021); How to Set your Cam Timing (2018)                                                                                 |
| subframe                     | How to Drop a Mini Rear Subframe (2018); Putting the Subframe Back (2018)                                                                                       |
| stainless steel line kit     | Installing Hel Custom Braided Clutch and Brake Lines (2020)                                                                                                     |
| bonnet latch, hood latch     | Classic Mini Hood Pins (2019); Vertical Hood Hinge Install (2016)                                                                                               |
| cup holder                   | Minivation Cupholder Install (2016)                                                                                                                             |
| air vent                     | How does the Heater Work? (2016); Heater Delete (2016)                                                                                                          |
| bad wolf, giveaway           | 20+ Operation Bad Wolf episodes; 12 giveaway videos                                                                                                             |

No video matched: spark plug colour reading, rear light bulb, seat belt, rear seat, glovebox,
door caps, half moon seals, roof rack, spot light bracket, wheel arch flares, air
conditioning, centre console, turn signal canceller, window stay, C pillar, compression
ratio, tie rod / track rod, injector fuse.

## 7. Language

| Measure                                             |                          Non-English share | Source              |
| --------------------------------------------------- | -----------------------------------------: | ------------------- |
| People who used in-page search, by browser language |                            184 / 829 = 22% | [PH]                |
| In-page search events, by browser language          |                        1,258 / 5,272 = 24% | [PH]                |
| Palette opens, by browser language                  |                             58 / 377 = 15% | [PH]                |
| Chat messages, by browser language                  | 42 / 184 = 23% (Italian 25, from 4 people) | [PH]                |
| Query text written in a language other than English |                                   about 4% | [PH] + [SB], manual |

Top non-English browser languages among searchers: French 40 people, German 27,
Portuguese 25, Dutch 24, Danish 11, Spanish 10, Norwegian 8, Italian 7, Chinese 7.
Non-English query text seen: German (`schaltpläne`), French (`culasse`, `bougie`),
Italian (`spurgo freni`, `termostato`), Portuguese (`laranja`), Japanese (`シートベルト`,
`キャッチ`, `バックル`, `97年ecu配線図`), Dutch (`thernschakelh`). Non-English visitors
search in English almost always, so the UI translation is doing its job and the gap is
in matching the few native-language terms.

External AI assistants sent 43 visits [PH]: ChatGPT 27, Copilot 8, Claude 4, Perplexity 4,
Gemini 1. Landing pages: `/models`, home, `/technical/chassis-decoder`,
`/technical/needles`, `/archive/electrical`, `/technical/torque`, the ADK3502/ADK3503
parts lists.

## 8. Top 25 content gaps, ranked by demand

Demand = weighted misses plus zero-result final queries across all surfaces. Action
types: index, synonym, tool, page, video, data.

| #   | Gap                                                  | Demand | Evidence                                                                                                                                                     | Recommended action                                                                                                                                                         |
| --- | ---------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Wiring diagram by year and trim                      |    ~90 | 48 year+model and 17 bare-year queries on `/archive/electrical`, 50 of 65 zero; `mini 1000cc 1980` 8 misses                                                  | **synonym + data**: add `from`/`to` years and trim aliases (Mayfair, City, Special, Mk3, Mk4, SPi) to the diagram index; resolve a bare year to the diagrams that cover it |
| 2   | Parts archive not in the palette                     |    ~74 | 42 palette misses match `parts.description` (bonnet, seat belt, glovebox, radiator, thermostat, rear lamp, cone, snorkel, alternator, manifold, pedal, loom) | **index**: add `parts` to `omnisearch()`                                                                                                                                   |
| 3   | Videos not in the palette                            |    ~60 | 30 how-to misses have a matching title (§6)                                                                                                                  | **index**: search the KV video catalogue from `runOmnisearch`, as the chat already does                                                                                    |
| 4   | Torque search scoped to one table and substring-only |    ~50 | `wheel` 16 people; `wheel nut torque`, `lugnut torque`, `1st motion nut torque`, `sump` all zero although the rows exist                                     | **synonym**: search all five tables at once; token AND match; aliases lug nut, sump plug, 1st, transmission main nut                                                       |
| 5   | Paint-code lookup                                    |     31 | 53 code queries, 31 zero (`cne`, `rbk`, `gr34`, `7099m`, `blvc1230`)                                                                                         | **data**: confirm short codes, BLVC and PPG/Dulux codes are populated and searched; **synonym**: strip spaces                                                              |
| 6   | Documents by model and year                          |     56 | 44 model and 12 year queries zero                                                                                                                            | **data**: model, marque, year-range metadata on `archive_documents`; **synonym**: mk3 = mkiii, truck = pickup                                                              |
| 7   | Colour names with typos or no space                  |    ~30 | `primroseyellow` and 8 other spellings, `cotswoldyellow`, `postoffice`, `britisg`                                                                            | **synonym**: trigram or Fuse matching on the colour page and in `omnisearch()`                                                                                             |
| 8   | MPI-era (1997–2000) wiring diagrams                  |    ~12 | `mpi` 3 people zero, `1997 rover mini`, `1999 model`, `2000`, `mini cooper 2001`                                                                             | **page**: add the MPI diagram set; genuinely missing                                                                                                                       |
| 9   | Fuel-injection fuse and relay guidance               |     11 | `injector fuse` 6, `fuel injection` 3, `mems relay`, `1991 spi`                                                                                              | **page + video**: SPi/MPi fuse box and relay guide; the 1995–96 fuse-box diagram is the seed                                                                               |
| 10  | Haltech / EFI / ECU map                              |      9 | `haltech` 5, `map` 2, `air conditioning wiring ecu`, `97年ecu配線図`                                                                                         | **page**: an EFI conversion hub that links the free ECU map, the wiring videos and the Haltech tune trip                                                                   |
| 11  | Compression-ratio synonyms                           |      4 | `comp ratio` 3, `bore strok`                                                                                                                                 | **synonym**: token match in `rank()`; add `comp`, `ratio`, `bore`, `stroke`                                                                                                |
| 12  | Casting-number identification                        |     10 | `12g940`, `12m3412`, `12041897`, `pd16`, `12hd16`                                                                                                            | **page**: head and block casting-number reference; **index**: part numbers in the palette                                                                                  |
| 13  | Chassis or engine number typed into the palette      |      3 | `xc2s1n1056418b`, `vin`, `xn2s1n…` starter                                                                                                                   | **tool**: detect the shape and route to the decoder                                                                                                                        |
| 14  | Needle code typed into the palette                   |      3 | `bdl` 2, `twin su`                                                                                                                                           | **tool**: detect a two-to-three-letter needle code and route to `/technical/needles`                                                                                       |
| 15  | Wheel size and offset syntax                         |      7 | `10x5`, `13x7`, `5”`, `et35`, `10” 5inch`                                                                                                                    | **synonym**: parse `WxD`, `ET`, inch marks on the wheel page                                                                                                               |
| 16  | Registry by year or plate                            |     20 | 20 of 26 registry queries zero                                                                                                                               | **tool**: year filter and plate-shape match on `/archive/registry`                                                                                                         |
| 17  | Torque rows missing                                  |    ~15 | `radiator`, `fan`, `shock`/`damper`, `pedal`, `starter`, `alternator` bracket, `u bolts`, `belt`, `tensioner`                                                | **data**: extend `torqueSpecs.json`                                                                                                                                        |
| 18  | Suppliers not in the palette                         |      5 | `bagsport` 3, `kad`, `dunlop`                                                                                                                                | **index**: add `/archive/suppliers`                                                                                                                                        |
| 19  | Interior and body trim how-to                        |    ~12 | glovebox latch, door caps, seat belt, rear seat, centre console, window stay, C pillar, roof rack                                                            | **video**: an interior refresh series; parts archive covers the parts                                                                                                      |
| 20  | Brakes how-to                                        |      7 | `brake cylinder install` 3, `brake bleeding` 2, `spurgo freni`, `booster`                                                                                    | **index** the 2016 and 2018 videos; consider a 2026 refresh                                                                                                                |
| 21  | Cooling how-to                                       |      7 | `radiator` 2, `thermostat`, `coolant temp`, `fan kit`, `water` 5 on torque                                                                                   | **index** existing videos; add torque rows                                                                                                                                 |
| 22  | Engine and gearbox removal                           |      7 | `engine removal` 2, `clutch removal`, `remove gearbox`, `engine plate`, `rotation jig`                                                                       | **index** existing videos; link the engine stand plate model                                                                                                               |
| 23  | Modern BMW MINI visitors                             |     22 | 22 electrical queries for 2001+ cars                                                                                                                         | **page**: a no-results hint that the site covers 1959–2000, with an outbound link                                                                                          |
| 24  | Channel content in the palette                       |      9 | `bad wolf` 5, `giveaway` 2, `podcast`                                                                                                                        | **index** series and project-car pages                                                                                                                                     |
| 25  | Native-language technical terms                      |    ~10 | `schaltpläne`, `culasse`, `spurgo freni`, `シートベルト`, `termostato`                                                                                       | **synonym**: a small per-locale term list mapped to English index terms                                                                                                    |

## 9. Chat versus search

**What the chat gets that search does not.**

- Whole questions with a vehicle context: "on an A-series", "a 1275 with an HIF44", "for
  motorway cruising". Search boxes get one or two nouns.
- Procedures and choices: which needle, which final drive, how to do a job. The starters
  drive this, and 9 of 20 starter clicks were the torque question.
- Buying advice: "best place to buy a rocker cover". The site has a supplier directory and
  a marketplace but no search path to "where do I buy X".
- Non-English conversations: Italian, Spanish, German, French, Czech, Chinese, Dutch. The
  chat answers in the visitor's language; the search index is English.
- Follow-up. 1.7 messages per conversation is low, but it is more than one.

**What search gets that the chat does not.**

- Identity lookups: a paint code, a wheel brand, a year, a chassis number. These are
  faster to type into a box than to phrase as a question, and the answer is a row, not a
  paragraph.
- Browsing within a surface: `blue` on the colour page, `minilite` on the wheel page,
  `1978` on the diagram page. The visitor wants the list, then picks.
- Part numbers and codes: `12g940`, `adk3502`, `msf1143`. Nobody asked the chat about a
  part number.
- Volume: about 25 searchers for every chat user.

**Implication for the unified-search design.** Routing beats merging. A typed query
should first be classified: code shapes go to the matching tool or table (chassis,
engine, needle, paint, part number), one or two nouns go to the index across every
surface including parts, videos, suppliers and models, and a question shape goes to the
chat with the query prefilled. The zero-result state should always offer the chat and
the Most Wanted request, which today has zero rows.

## 10. Method

1. Supabase: pulled every row of `archive_search_misses`. Collapsed prefixes by keeping
   only rows whose `normalized_query` is not a strict prefix of another row's
   `normalized_query` (the "tip" of each keystroke chain). Weighted by `miss_count` of
   the tip row only.
2. PostHog: confirmed event names and properties with `read-data-schema`. Collapsed
   `search_performed` the same way, per person per day per surface, keeping the
   `results_count` of the tip query. Palette queries came from `omnisearch_view_all`
   (the only palette event that carries text) and were merged with the miss log.
3. Themes: in-page sub-themes by regular expression in HogQL (approximate; a few
   short tokens fall in the wrong bucket, for example `plug` under wheels). Palette
   and chat themes by hand.
4. Content check: `parts.description` ILIKE for part names; `data/torqueSpecs.json`,
   `data/wiringDiagrams.json` and `data/models/toolbox-catalog.ts` for the static
   surfaces; the uploads playlist (466 titles) for videos, title substring only.
5. Language: `$browser_language_prefix` for people and events; manual inspection of
   query text.
6. Excluded: one query that was a personal name; PostHog rows flagged as bots (none of
   the search or chat events carried the bot flag).

## Appendix A: SQL (Supabase)

```sql
-- A1. Miss log summary
select count(*) as rows, sum(miss_count) as total_misses,
       min(first_seen_at), max(last_seen_at),
       count(*) filter (where promoted_request_id is not null) as promoted,
       count(*) filter (where dismissed_at is not null) as dismissed
from public.archive_search_misses;

-- A2. Collapse keystroke prefixes to their longest completion
with m as (
  select normalized_query q, miss_count c, first_seen_at from public.archive_search_misses
), tips as (
  select q, c, first_seen_at::date d from m a
  where not exists (select 1 from m b where b.q <> a.q and b.q like a.q || '%')
)
select q, c, d from tips order by c desc, q;

-- A3. Chat storage (user-role messages only, last 90 days)
select t.created_at::date as day, t.message_count, m->>'role' as role,
       left(coalesce(m->>'content', m->>'text', (m->'parts'->0->>'text')), 300) as content
from chat_threads t, jsonb_array_elements(t.messages) m
where (m->>'role') = 'user' and t.updated_at >= now() - interval '90 days'
order by t.created_at;

-- A4. Most Wanted and related tables
select (select count(*) from archive_requests) as requests,
       (select count(*) from chat_threads) as threads,
       (select count(*) from chat_usage_daily) as usage_rows,
       (select count(*) from saved_searches) as saved_searches;

-- A5. Does the parts archive hold the thing people typed?
select 'desc:bonnet', count(*) from parts where description ilike '%bonnet%'
union all select 'desc:seat belt', count(*) from parts where description ilike '%seat belt%'
union all select 'pn:12g940', count(*) from parts where part_number_norm ilike '12g940%';
```

## Appendix B: HogQL (PostHog)

```sql
-- B1. Event inventory, 90 days
SELECT event, count() AS events, uniq(person_id) AS users, min(timestamp), max(timestamp)
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY
  AND (event ILIKE '%search%' OR event ILIKE '%chat%'
       OR event IN ('no_results_shown','ai_referral','mcp_tool_gated'))
GROUP BY event ORDER BY events DESC

-- B2. In-page search by surface
SELECT properties.surface AS surface, properties.table_name AS table_name,
       properties.source AS source, count() AS events, uniq(person_id) AS users,
       countIf(properties.results_count = 0) AS zero_results,
       countIf(properties.query = '' OR properties.query IS NULL) AS empty_query
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'search_performed'
GROUP BY surface, table_name, source ORDER BY events DESC

-- B3. Collapse keystroke prefixes per person per day, keep the tip's result count
SELECT surface, t.1 AS query, t.2 AS results_count, count() AS searches
FROM (
  SELECT surface, pid,
         arrayJoin(arrayFilter(x -> NOT arrayExists(o -> o.1 != x.1 AND startsWith(o.1, x.1), ts), ts)) AS t
  FROM (
    SELECT surface, pid, d, groupArray(tuple(q, rc)) AS ts
    FROM (
      SELECT coalesce(properties.surface, properties.source, 'unknown') AS surface,
             person_id AS pid, toDate(timestamp) AS d,
             trim(lower(properties.query)) AS q,
             argMax(toInt(properties.results_count), timestamp) AS rc
      FROM events
      WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'search_performed'
        AND length(trim(properties.query)) >= 2
      GROUP BY surface, pid, d, q
    ) GROUP BY surface, pid, d
  )
) GROUP BY surface, query, results_count
ORDER BY surface, searches DESC, query LIMIT 500 OFFSET 0

-- B4. Palette view-all queries
SELECT properties.query AS query, toInt(properties.results) AS results, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'omnisearch_view_all'
GROUP BY query, results ORDER BY n DESC, query LIMIT 200

-- B5. Palette clicks by surface and destination
SELECT properties.surface AS surface, properties.url AS url, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'omnisearch_result_selected'
GROUP BY surface, url ORDER BY n DESC LIMIT 120

-- B6. Weekly series
SELECT toStartOfWeek(timestamp, 1) AS week,
       countIf(event = 'search_performed') AS in_page_search_events,
       countIf(event = 'omnisearch_opened') AS palette_opens,
       countIf(event = 'omnisearch_result_selected') AS palette_clicks,
       countIf(event = 'omnisearch_view_all') AS palette_view_all,
       countIf(event = 'chat_message_sent') AS chat_messages,
       countIf(event = 'floating_chat_submitted') AS floating_chat,
       countIf(event = 'chat_starter_used') AS starters,
       countIf(event = 'chat_run_completed') AS runs_completed,
       countIf(event = 'relative_needle_search') AS needle_search,
       uniqIf(person_id, event = 'search_performed') AS search_users,
       uniqIf(person_id, event = 'omnisearch_opened') AS palette_users,
       uniqIf(person_id, event = 'chat_message_sent') AS chat_users
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY
  AND event IN ('search_performed','omnisearch_opened','omnisearch_result_selected',
                'omnisearch_view_all','chat_message_sent','floating_chat_submitted',
                'chat_starter_used','chat_run_completed','relative_needle_search')
GROUP BY week ORDER BY week

-- B7. Chat starters, run outcomes, message shape
SELECT properties.prompt AS prompt, count() AS n FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'chat_starter_used'
GROUP BY prompt ORDER BY n DESC

SELECT toDate(timestamp) AS day, properties.outcome AS outcome, properties.tier AS tier,
       properties.locale AS locale, count() AS n, uniq(distinct_id) AS distinct_ids,
       countIf(toInt(properties.tool_call_count) > 0) AS with_tools,
       countIf(properties.membership_mentioned) AS membership_mentioned
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'chat_run_completed'
GROUP BY day, outcome, tier, locale ORDER BY day, n DESC

SELECT event, properties.$pathname AS pathname, count() AS n, uniq(person_id) AS users,
       round(avg(toFloat(properties.message_length))) AS avg_len,
       countIf(toInt(properties.message_length) > 120) AS long_msgs,
       countIf(properties.is_first_message) AS first_msgs
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY
  AND event IN ('chat_message_sent','floating_chat_submitted')
GROUP BY event, pathname ORDER BY n DESC

-- B8. Language and AI referrals
SELECT event, properties.$browser_language_prefix AS lang, count() AS n, uniq(person_id) AS users
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY
  AND event IN ('search_performed','omnisearch_opened','chat_message_sent','floating_chat_submitted')
GROUP BY event, lang ORDER BY event, n DESC

SELECT properties.ai_source AS ai_source, properties.entry_path AS entry_path, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'ai_referral'
GROUP BY ai_source, entry_path ORDER BY n DESC LIMIT 60

-- B9. Exchange zero-result filter
SELECT properties.$pathname AS pathname, properties.query AS query, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY AND event = 'no_results_shown'
GROUP BY pathname, query ORDER BY n DESC, query LIMIT 100
```

Sub-theme clustering (§4.1) wraps B3 in a `multiIf(match(q, '<regex>'), '<label>', …)`
over the collapsed rows and groups by label; the regular expressions are the sub-theme
names in the tables above.

## Appendix C: video title check

Fetch the uploads playlist `UUZIUfOFhrQ9nrR06IOoAJ2Q` with `playlistItems.list`
(`part=snippet`, `maxResults=50`, follow `nextPageToken`; 10 pages at 1 quota unit
each), then substring-match each miss against lower-cased titles. The same walk is what
`server/utils/youtubeCatalog.ts` does for the chat's video tool.
