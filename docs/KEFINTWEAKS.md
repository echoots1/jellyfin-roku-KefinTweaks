# KefinTweaks and Jellyfin Enhanced on Roku

This fork reads your server's [KefinTweaks](https://github.com/ranaldsgift/KefinTweaks) configuration and does natively
what it says. It also talks to Seerr through [Jellyfin Enhanced](https://github.com/n00bcodr/Jellyfin-Enhanced).
Change a KefinTweaks setting in jellyfin-web and the Roku follows it the next time you open Home. You don't need to rebuild.
With no KefinTweaks config on the server, the app behaves exactly like the official one.

## Install from scratch

1. **Turn on Roku developer mode.** With the Roku remote, press **Home ×3, Up ×2, Right, Left, Right, Left, Right**.
   Write down the IP address shown, choose **Enable installer and restart**, accept the license, and set a
   developer password. The Roku restarts.
2. **On your computer** (Node.js 18 or newer), in this repo:

   ```bash
   npm ci
   cp .env.example .env      # then put your Roku's IP and developer password in .env
   ```

   `.env` is gitignored. Exporting `ROKU_IP` and `ROKU_PASSWORD` as environment variables works too.
3. **Build and install with one command:**

   ```bash
   node scripts/kefin-deploy.mjs
   ```

   It builds the app, zips it and sideloads it over your LAN. The app starts on the TV.
   `--no-build` re-sends the last build.
4. **Watch the debug console:** `telnet <roku-ip> 8085`. KefinTweaks lines start with `[KefinTweaks]`.
   On startup it lists every setting and how the Roku handles it. Each time Home finishes loading it prints a
   `Home rows: ...` line with the rows in order.

The sideloaded app is separate from the Jellyfin app installed from the Roku store.

## What it does

| KefinTweaks setting | On Roku |
|---|---|
| `homeScreen` (`homeScreenConfig`) | Every enabled section that isn't a native Jellyfin one becomes a home row, placed by its `order` around the native rows (My Media, Continue Watching, Next Up, Recently Added): Featured, seasonal rows (inside their date window), IMDb Top 250, Watchlist, popular studios and genres, collections, live TV queries, tag cards. Each row is cached for its section's `ttl`. Discovery sections add 6 rows at the bottom of Home, refreshed every 6 hours (the web scrolls them in endlessly). |
| `watchlist` | Uses the same storage as the web, the item's **Likes** flag. Watchlist row, **Add To Watchlist** button on movie and episode screens and a **Watchlist** button on series screens, Home Options (*) entry. Watched items are removed automatically, like KefinTweaks' sync. |
| `search` + `search.enableJellyseerr` | A **Request with Seerr** row under the search results (titles you don't already have). |
| `customMenuLinks` | Shown as buttons next to Search and Settings: **Discover** (Seerr trending, popular and upcoming), **Requests** (your Seerr requests), **Calendar** (Sonarr/Radarr releases). Links are matched by keyword; web-only links (Statistics, external URLs) are hidden. |
| `flattenSingleSeasonShows` | Shows with one season open straight on the episode list. |
| `versionPreferences` | Movie screens pre-select the version KefinTweaks ranks first (edition order, then version order). |
| `removeContinue` | Options (*) → **Remove From Continue Watching** resets the resume point and keeps the played state. |
| `subtitleSearch`, `thumbnailScrubber`, `collections`, `infiniteScroll`, `playlist` | Already in the app. |
| `seriesInfo` | Partial: series screens already show episodes, runtime and year. |
| `watchTogether`, `itemDetailsCollections` | Not built yet. KefinTweaks itself only loads `itemDetailsCollections` on Jellyfin 10/11. |
| skins, themes, header tabs, breadcrumbs, hamburger menu, games, web bug fixes, user manager | Not possible or not needed on Roku. |

Seerr features need Jellyfin Enhanced with Seerr configured, and your Jellyfin user linked to a Seerr user.
The app asks Enhanced (`/JellyfinEnhanced/jellyseerr/user-status`) and hides Seerr features when either is missing.
Requests go through Enhanced as you, so the Roku never holds a Seerr API key.

## How the config is read

KefinTweaks keeps its admin config in a JavaScript Injector script, `KefinTweaks-Config`
(`window.KefinTweaksConfig = {...};`). JavaScript Injector serves that script, without login, at
`/JavaScriptInjector/public.js`; `private.js` is tried with your login token if the script was marked as needing
authentication. No admin rights are needed. The app re-reads the config at most every 30 seconds, when Home is shown.
- **Server unreachable:** it keeps the last good copy.
- **Config missing or unreadable:** it uses stock app behavior.

The code lives in `source/kefin/` and `components/kefin/`. The upstream files only carry small hooks; search for
`kefin` in `components/home/Home.bs`, `components/home/HomeRows.bs`, `components/search/SearchResults.bs`,
`components/movies/MovieDetails.bs`, `components/tvshows/TVSeriesDetails.bs`, `source/MainEventHandlers.bs` and
`source/ShowScenes.bs`.

## Things that may need upkeep

- **KefinTweaks home screen format.** `homeScreenConfig` is the part of KefinTweaks that changes most (it ships
  migration code). New section types or data sources are skipped and logged (`Unsupported ... - skipped`) instead of
  shown.
- **Menu links are matched by keyword** (`discover`, `request`, `calendar`, `watchlist` in the link's name, action
  or URL). A link renamed without those words disappears from the Roku.
- **Jellyfin Enhanced's API isn't versioned.** A plugin update could move the Seerr, requests or calendar endpoints
  (`components/kefin/KefinDataTask.bs`).
- **Discovery rows are approximations.** KefinTweaks builds "top directors/actors" from a full library cache; the Roku
  uses a random sample of your library instead.
- **IMDb Top 250** downloads the same public list KefinTweaks uses (raw.githubusercontent.com), once a day.
- **Upstream merges:** about 35 hook lines in 7 upstream files. Conflicts, if any, are in those lines.
