# npm support request — release the unowned package name `lloyal`

**Route:** https://www.npmjs.com/support (signed in as `lloyalty`) → "I have a
different problem" / package name issue. Not the *disputes* process — that is
for names someone else owns, and this name has no owner.

**Subject:** `Package name "lloyal" blocked by similarity filter — name is unregistered, company name, false match against "global"`

---

Hello,

I'm requesting that the package name **`lloyal`** be released for publication to
my account (`lloyalty`, owner of the `@lloyal-labs` organization).

**The name is not taken.** `GET https://registry.npmjs.org/lloyal` returns 404 —
no one has ever published it. This is not a dispute over an existing package and
I am not asking for anything to be transferred.

**It is blocked by the similarity filter, as a false positive.** Publishing
returns:

```
npm error code E403
npm error 403 Forbidden - PUT https://registry.npmjs.org/lloyal
  Package name too similar to existing package global;
  try renaming your package to '@lloyalty/lloyal'
```

The flagged match is `global` — an unrelated package (a Node globals shim) with
no connection in meaning, ownership, or ecosystem to my project. The two words
differ by two characters, which appears to be enough to trip the heuristic, but
no user typing `lloyal` is plausibly reaching for `global`, and vice versa.

**`lloyal` is my company's name.** Supporting ownership:

- **Domain:** `lloyal.ai`, plus the operating subdomains `apps.lloyal.ai`,
  `api.lloyal.ai`, `docs.lloyal.ai` and `hdk.lloyal.ai`
- **npm organization:** `@lloyal-labs`, from which I already publish eight
  packages — `@lloyal-labs/sdk`, `@lloyal-labs/rig`,
  `@lloyal-labs/lloyal-agents`, `@lloyal-labs/channel-verify`,
  `@lloyal-labs/binding`, `@lloyal-labs/host`, `@lloyal-labs/relay`,
  `@lloyal-labs/lloyal.node`
- **GitHub organization:** `github.com/lloyal-ai`
- **Existing unscoped packages under this account:** `reasoning.run`,
  `harness.dev`, `lloyal-ai`

**What it is for.** `lloyal` would be the CLI entry point for our developer
toolkit — the command a developer runs to scaffold a project, in the same role
as `npx create-vite` or `npx astro`. The value is specifically in the `npx`
invocation: `npx lloyal new`. We have published `lloyal-ai@0.11.0` as a working
stand-in, and its `bin` is already `lloyal`, so a global install produces the
right command today. Only the `npx` short form requires the bare package name.

**Scope of the request.** I'm asking only that the similarity block be lifted so
this account can publish `lloyal`. I'm not asking for a reservation, and I'll
publish a real release immediately rather than park the name. If it would help,
I'm happy to publish under a pre-release tag first, or to accept any condition
you'd normally attach.

Thank you for taking a look.

Zuhair Naqvi
npm: `lloyalty` · org: `@lloyal-labs` · `lloyal.ai`

---

## Notes for us, not for npm

- **Send it from the `lloyalty` account**, signed in, so the ticket is tied to
  the org that would receive the name.
- If they refuse, `lloyal-ai` stands and nothing needs undoing — the only change
  on success is the `npx` line in the docs, and `lloyal-ai` becomes an alias that
  keeps working.
- Do **not** frame this as a dispute. Disputes are for contested ownership and
  route to a slower process with different criteria; this is a filter false
  positive with no counterparty.
- Worth knowing if they ask for alternatives: `lloyal-ai`, `lloyal.ai` and
  `lloyalai` all normalise to the same string under the filter, so they are one
  option, not three.
