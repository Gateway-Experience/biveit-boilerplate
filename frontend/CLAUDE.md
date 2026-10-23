ANH'S CODING PRINCIPLES & BEST PRACTICES:
========

Below are the coding principles, conventions and best practices that you must follow when designing techincal solutions and writing code. Some might apply to long/meaty tasks like designing a whole system or mechanism, or writing large amount of code; some might apply to making small changes or the actual coding act inside the bigger tasks (like dont mutate a variable).

You must follow them as closely as you can. But be sensible about this. Exceptions can be made, but only with very good reasons, or in low stake cases like doing a quick test or writing a small POC/script. But in general, there is nothing to lose by following these principles and practices.

Sometimes, when working with an existing codebase, you can adopt the existing convention (e.g. boilerplates, module arrangement), if it's not too conflicting with the principles here. Even so, we should stick to our principles as much as we can. For example, we can adopt the convention of creating a static class for persistent logic (even though they're better off as independent functions), but we don't have to follow the existing imperative practice of modifying the array inline (e.g. array.push in js) and instead use something declarative (like spreading notation).

----
PHILOSOPHIES:

Here are some high-level philosophies that will aid in how you approach a problem or design a solution. Mostly they're considered when planning/doing system design, although sometimes they could be applied to the actual coding.

## Topology

Borrowed from the mathematical branch of topology: many designs are functionally *the same shape* (same topology) — the difference is only which shape is most convenient for the situation at hand.

- Don't agonize when choosing among functionally-equivalent options. They're equivalent in *what they can express*; they differ only in **convenience and efficiency**, and that depends entirely on the actual scenario the system is in. No silver bullet. Design then reduces to **choosing the best shape for the job** — provided the topology isn't *corrupted*.
- Example: storing custom fields in a JSON column vs. a separate key-value table — functionally the same, same topology. Normalized vs. denormalized schema — same topology. *("It's the same topology anyway, man.")*
- **Refactoring** keeps the topology *the same* — nothing added or removed — and just reshapes the codebase into a more aesthetic shape. (Contrast this with *collapsing* topology below, which genuinely destroys information; refactoring never does.)

**Collapsing topology** is the failure mode to watch for. You collapse (corrupt) a topology when you write a *derived* value into the place originally meant for a *base* value — e.g. computing a user's effective subscription plan and overwriting their original plan with it. The original is now *lost*; the informational shape is permanently reduced. Compare to writing the derived value somewhere else, or not persisting it at all (recompute each time) — both preserve the topology. **Watch for any place a design overwrites source information with something derived from it.** This is the same idea as base-vs-derived under [Declarativeness](#declarativeness), seen geometrically.

## Synchronicity (or the absence of the need for it)

**Avoid syncing between two data sources.** Maintaining consistency between sources is the mother of most bugs. Whenever a design introduces syncing *in any shape or form*, stop and reason about why it's necessary — and whether it can be reduced to a single source.

- The only legitimate excuse is **efficiency or convenience** — e.g. multiple indexes over the same source. A CDN is a kind of "physical index" as opposed to a logical one. But that's infrastructural; in ordinary application code you usually should *not* be deriving and persisting parallel structures. (Shares ground with [Topology](#topology): a redundant copy is a second shape claiming to be authoritative.)
- When syncing genuinely *must* happen, it must go through a **guaranteed mechanism** that gives you eventual consistency *at the conceptual level* — transactions, or event logging. Keywords to reach for: **append-only log, monotonically increasing sequence number / watermark, idempotent**.

## Declarativeness (as opposed to imperativeness)

- **Pure functions, as much as possible.** A function's signature should make sense *on its own*, read in isolation, divorced from where it's called. (Caveat: "makes sense" doesn't mean "tiny" — don't shred the design into a swarm of micro-functions; reserve small functions for genuinely distinctive or repetitive utilities.)
  - **Statelessness** follows from this and buys you reasoning, predictability, repeatability, and a path to **idempotence** — which is one of the great comforts in software.
- **Compute next actions from current state — don't precompute future state.** A bad, over-reactionary design precomputes future state in a precipitous way (over-fitting to the requested feature), producing derived state that drifts and goes buggy. Instead store *the current state as it is — no more, no less*; that, plus the input at invocation time, is enough to derive every output that could ever be needed. (Note how much **abstraction skill** this takes — designing is partly the skill of seeing what the minimal true state is.)
- **Immutability.** Prefer not mutating a variable or object/array. If a value flows through stages, give each stage a new name (`data` → `data_with_users` → `data_deduped` → `data_deduped_enriched`). **Exception:** performance — and it must be *intentional and commented*. Cloning arrays of tens of thousands of elements is real cost; when you mutate for that reason, say so clearly in the design.
- **Base information vs. derived information** — this parallels declarative-vs-imperative directly, and it's arguably the spine of this whole document.
  - *Base* information is the most declarative thing there is: it's closest to the real world or the source systems, and declaring it *in full* is **complete** — every derivable fact can be reconstructed from it. Storing *derived* information feels imperative; defining only the *derivation rule* from base information feels like writing a pure function (declarative).
  - **So, when designing, present the base information first. Model the world as it is** — rather than being imperative, over-fitting to the immediate feature, and losing sight of the source truth underneath.

## Duality of table and stream

A **table** (or state) is data *at rest* — collapsed, the accumulated result. A **stream** (e.g. a change stream / event log) is the same data *in motion* — the sequence of changes that produced it. They are two views of one thing, and you can convert between them: fold the stream and you get the table; diff the table over time and you get the stream.

This duality is a design lens, not just trivia:
- A table is the *derived* view; the stream of changes is closer to *base* information (it's append-only, nothing overwritten — so it never collapses topology). When you keep only the table, you've folded the stream and **discarded history** — sometimes correct (you don't need it), sometimes a topology collapse you'll regret.
- When a design needs auditability, replay, eventual consistency, or "how did we get to this state," reach for the **stream** form (append-only log + watermark + idempotent consumers — same keywords as [Synchronicity](#synchronicity)). When it needs fast point-in-time reads, reach for the **table** form. They're not in conflict; you often keep the stream as the source of truth and treat the table as an index over it.
- Ask of any stateful design: *am I storing the collapsed result, the sequence of changes, or both — and is that the shape this job actually needs?*
----

----
CODING PRINCIPLES:
- Colocation: related code or functions and related helpers/parameters should stay as close to each other as possible. Also relatd states under a domain should stay centralized instead of scattered (e.g. think global redux state).
- DRY: if some logic feels high-level or is repeated a lot, extract to a common function/module. This requires some thinking though, since just because some code look similar doesn't mean they are the same and should be extracted. This depends on how generic the code is (high level code, utilities, or foundational; or specific and use-case dependent). Sometimes this is more clear after the code is written, so you can always come back and decide what should be extracted out. One rule is that if the code has to be modified a lot to be extracted out, then it shouldn't be.
- Avoid OOP as much as possible.
- Separation of concern: when designing functions and modules, try to think if any item can stand on its own, and encapsulates enough (no more, no less) logic. It should function nicely if another use case need the same functionality from it and can just use it right away because there is no other unrelated logic got mixed up in. For example, if a transportation platform uses pathfinding logic, that pathfinding logic should stand on its own so it's can be readily reused in a computer game.
  - Colocation and Separation of concern are 2 most important principles when deciding where to put code (either file-level or routine-level).
  - Again, separation of concern is very important and you often get this wrong. When designing where code goes you should think hard. For example, a deduping mechanism using redis should have generic redis operations in 1 file/module, and the deduping logic that makes use of the redis operations in another file/module that is more logic-oriented.
- All the other principles and advices should be taken along with this one: don't over-engineer. Don't overdo any advices. Simplicity is best. Use your common sense.
----

----
COMMENTING:

Types of comments that you should be writing:
- Showing intention: also starts with `Intentions:` e.g. `# Intentions: ...` (depending on the language). This says what the code does. Doesn't have to write comments for every line of code, but for a meaningful block of code, or a function, that shows the tangible intention of the writer. The reason it exists so to speak. This applies so strongly to for example a hacky variable or logic, the reason they exist were to solve such and such problem, otherwise they wouldn't exist at all. Also in general the intentions should help with narrating the code so it's easy to read the code as an outsider.
- Referencing: association between information is important for them to be connected. You can reference another code snippet, a function, an url, a task etc. E.g. this logic is related to that logic over at the other section. Use `References:` preamble e.g. `# References: ...`.
- Original purpose: use e.g. `# Original purpose: ...` to describe the reason why this function or code was generated (e.g. the feature being implemented at the time, or the API endpoint that it serves). This helps a lot when the human is reading code to know the context of the code's existence or what flow it belongs to. The majority of code written only serves 1 purpose anyway. That being said, dont use this comment directive for generic code (based on your judgement) that could be called in many places, even if at the time only 1 flow uses it. Generic, utils or core functions are such examples.
- Parameters/variables: sometimes you can say the function/method does X, but the parameters might not make too much sense or are ambiguous. For example source and destination param of a function can be confusing to tell which is which. Also some variables have special purposes like for keeping track for a recursive-like logic, acting as output store (for some languages like C++) etc. If their meaning is not immediately apparent, comment say what they are and/or how they are used. Being brief is fine on need to write a lot.
- Whether a function is pure: can just be a 1 liner comment e.g. `# [Pure]`, or can say it casually in another longer comment. `[Pure]` means completely pure, no I/O and mutation, purely in memory and like a math function. `[Pure-ish]` means generally pure, could do read I/O, but nothing serious happens in the real world (even maybe some logs get written but as long as they dont affect the main logic. But if the log is the main purpose of the function, then writing log is not pure-ish at all).
- IMPORTANT: for the writing style, write it as if you're talking to a person. Make it sound casual, easy to absorb, and not cryptic. Comments are meant to be read by human. Also make them concise and not wordy, while styling sounding human. Dont put context that's too specific to the immediate context in the comments. This needs some judgement and taste though because things decided in the moment could actually be relevant and should be put in the comments. But just know that there is a knob and you have to decide wisely whether the immediate context (e.g. from discussing with the human) should be put in the comments or not.

DON'T write comments for the sake of having them. If something is obvious from the code, don't put comments in. Don't say:
```
# Looping over array extracting x
extracted = [item['x'] for item in items]
```
Be sensible. Imagine a stranger reading the code. They don't need to know every little details (except for the non-trivial ones that could make or break the system).
Comments don't have to be huge paragraphs either. Be brief. As long as it contains enough information and is doesn't feel obscure when reading.
Make sure to write comment for hidden implications or gotchas.

Avoid generic naming. Names like `expand`, `field` are too ambiguous. Some intention and context should be in the names themselves (just make sure they're not too long and verbose). Generic names like above are acceptable only when the context is clear (e.g. a member of some upper entity that contains the context already), or are truely generic.

Comments shouldn't be too formal or verbose, should be easy to read, e.g. can adopt blogging writing style. Also don't be too brief to the point it's obscure. Should feel like a reddit comment: casual but explanatory.
----

----
DESIGN PATTERNS:

This section lists some design patterns that might be helpful. Use common sense to pick what's best depending on the situation.

Type-ID combo:
Easiest way to make a system/feature extensible. E.g. actorType + actorId, objectType + objectId. To extend to a new object/entity type, or merging data from a new system, just define new types. Becareful not to overdo it if the type classification is trivial (e.g. we know there's only 1 type) or when the need for extending is unlikely.

Indexing a dataset:
There 2 main ways of indexing into an element within a structured dataset:
- Path-based (e.g. file path). This requires the data to be structured as a graph-like or tree-like structure. B-tree itself is a path-based index since we traverse from the root node to the desired node. So is zone-mapping (there is a hierarchy of sort involved).
- ID-based: pointing to the exact element, by passing the hierarchy. Example: css selector by id, labelling entries (so they can be pulled directly by labels), hash tables.
A dataset or database equipped with these 2 indexing mechanism is usually good enough for most cases.
An example: a text-based knowledge base can index the knowledge items by paths (file path and then maybe section name of the item), or by IDs (e.g. tagging certain items with a unique identifier, inline).

Sharding:
Apply in any situation that O(f(n + n + ... + n)) < O(f(n)) + O(f(n)) + ... + O(f(n)) (kn is sharded into k shards of size n).
E.g. A join B on x. The value space if x (say of size kn) could be sharded.
Before sharding: A join B ~ O(k^2 * n^2). After sharding: A join B ~ O(k * n^2)
----

----
Module imports should be put on top of the file. Dont import in the middle of a function unless there is a very good reason to do so. Also import builtin/installed libs/packages first then come the project's modules.
Private functions (not exposed to external files) should be prefixed with (at least 1) underscore.
Function/method names should always start with a verb (unless there is a very good reason to do otherwise).

JS-specific conventions:
- Use defensive programming (optional chaining or lodash).
- To test some services, use something like `setTimeout(async () => { /* test content */ }, x000)` and edit inline in the file (saving the file sometimes reloads the project so can check your test right away). Use console.log in conjunction to check in the service's terminal.
- Additional non-primary parameters can all be put in an `options` parameter to a function. E.g. `function f(id, id2, options = {})`. Caller can omit `options` param.
- Write declarative code, use \`const\` variable declaration, avoid mutating object (unless it's for efficiency reasons or if writing absolute immutable code make it too cluttered somehow). An example where it's okay to mutate variables is \`let data; if (cacheHit) { data = cache[key]; } else { data = await get(); }\` (the variable cant be declared in the if else blocks so it has to be outside and mutable, but only for initiation).
- For frontend code (if we're working with frontend), you should sprinkle `data-...` attributes in relevant components to help with debugging/testing. For example: `data-userid`, or `data-itemid` for each item in a list. The 2nd part of the attribute name should be all lowercased alphanumeric characters.
----

END OF ANH'S CODING PRINCIPLES & BEST PRACTICES
========

# Frontend Conventions

## Policy

- Import order: import installed packages first at the top of each file, then import project's modules.
- For functions with many configurational parameters, group them in an \`options\` parameter as the final parameter to a function (e.g. \`function doit(mainArg1, mainArg2, options = {})\`). This makes it easy to add/remove parameters later. The caller can omit this parameter if it doesn't want to pass any in.
- Follow existing conventions, either specifically given to you or implied in the existing/example codes. Refrain from doing anything extra like excessive try-catch (we already have a outer try-catch wrapper for logging errors, only do this when there is a very specific case where you're intested in the error in question) or edge case handling of parameters that we have absolute control of.
- Design and write code with ease of debugging in mind. For example:
  Embed user id, record id or id of items in a list in hidden divs to aid with debugging. E.g. \`<div style={{ display: 'none' }} data-userid={userId} />\`.
- For likely-dynamic data (data that could be updated by the current page or by another session), fetch using \`callBe\`. For mostly static data (e.g. configuration), use \`useRequest\`.
- Many client state in a redux-like manner using \`useStore\`. E.g.: \`const set = useStore(state => state.set); const user = useStore(state => state.user); set({ user: newUser });\`.
- For most action-like requests (post, patch etc.), use \`useNotification\` to communicate request success/failure to users. Note that sometimes there are silent requests or requests trivial enough that don't need this kind of behavior. Also if there is a trigger element (e.g. button), decide if the element needs a loading state when requests are being carried out.
- There is a \`FullScreenLoading\` component that blocks the whole page using a mask. You can consider using this for page initialization until all data is available, or when a request is made that needs this behavior when the request is being handled. Don't abuse this though.
- All modal should be used using the available \`Modal\` component in the \`components\` directory for consistency.
- All site-wide initialization (e.g. socket connection init or i18n) are put inside \`AppProvider\` component.
- Use \`src/utils/hooks.js:useOneTimeQueryParams\` to redirect to a page with query parameters that are removed as soon as they are consumed. This is relevant in cases where an succesful action redirects to a new link and we want to notify the user that the action succeeded in the new page, but we don't want the notification to be there when user refreshes the current page.
- Use tailwind's mt-x and mb-x for spacing between different sections of a page. mt-4 amd mb-4 might be a good start. It will probably need to be finalized later anyway but try your best to estimate.
- For buttons that open/redirect to a page, use \`LinkButton\` to enable users to open in a new tab by a middle click.
- For some array state used with \`useState\`, you can use \`null\` to indicate the array as being uninitialized, and an empty array \`[]\` as initialized but empty.
- For list/array manipulation on the client side (especially when user can add to/remove from a list), you can use \`uuid.v4()\` to add an id to the item when it's created/added to a list so it has a \`key\` property when rendered. It could also helps with managing the item in the list. These ids are transient and should never be relayed to the backend i.e. you should remove them before submitting to backend. When a list (independent or in another object) is fetched from backend you can populate new client-side ids into them if you need to.
- \`useIsMobile\` is used heavily for mobile-responsiveness, unless it's automatically handled by the component or can be done purely by styling.
- Never use React class components. Always functional components.
- Regarding input fields and forms:
  + For input forms that need validation, use \`react-hook-form\` and wrap the input component  in the react-form component \`Controller\`. Example usage are in the \`ShowCase.jsx\` component.
- Some npm libraries/components that were used in other projects that we could reuse in suitable occasions:
  + react-infinite-scroll-component: For infinite scrolling
  + react-json-tree: For displaying (large) json objects to users
- Checkout \`ShowCase.jsx\` for example usages of various components/utilities. New pages should follow the conventions demonstrated in this file strictly (e.g. spacing, layout).
- Colors should use one of the color css var in the theme (see src/styles/index.css). Dont declare any new color code yourself outside of that place. This is so color theme is easy to manage and customize (together with light/dark theme switching).
- Keep the "preview location bridge" script in `index.html`. The site is previewed inside an iframe, and that script is how the preview's location bar learns which page the site is on. Removing or breaking it makes the bar stop following navigation.

## Directory structure

```
src/
  assets/  any resource files e.g. images, svg etc.
  components/  react components in general
    common/  common reusable base components. Whenever you need a new component or UI functionality check here first
    layouts/  layout components
    pages/  actual routable pages or group of components for a page (which can be in the form of a subfolder or a single file)
    shadui/  shadcn generated components, dont edit here
  data/  any source file that is data heavy e.g. jsons
  routes/  routing & navigation
  services/  logic and business domain. UI-framework agnostic. Can contain code for API calls
  state-store/  logic related to state storage (specific usage to be explored)
  styles/  custom css's. index.css lives here
  types/  all ts type declarations
  utils/  utility, helper & generic functions
```

Please follow the directory structure convention strictly.

## shadcn

We use shadcn for theming. The preset we use is https://shadcnpreset.com/preset/b1s91EQae (can check out the component gallery there). FYI it has built-in dark and light theme.

Use `npx shadcn@latest ...` to manage shadcn, e.g. to add a new component. This touches src/components/shadui (so you yourself shouldn't modify it manually).

The only thing to customize project-to-project is probably just the color scheme. You can do that in src/styles/index.css, the color tokens. Be sure to properly customize both dark and light theme.

## Logins

Keep the login token in localStorage and send it as `Authorization: Bearer <token>` (src/utils/request.ts) --
don't move to cookies. The user watches the site inside a preview embedded in another site, where browsers
restrict cookies: a cookie login seems to work, then logs them straight back out (in Safari it never works).

# Claude skills

If the ui-ux-pro-max@ui-ux-pro-max-skill claude skill is available, use it as a source of references and guidances on how to create nice, sensible, production-grade UI. It's more on the aesthetic and visual side, but stick to our coding convention and use shadcn as base ui components.

## Linting

Be sure to run `npm run lint` and `npm run typecheck` after your edits to make sure they are respected.