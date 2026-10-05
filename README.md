# Nick Bogert portfolio

A responsive, dependency-free portfolio for Nick Bogert. This is a separate project from the Anuluna website in the neighboring `site` directory.

## Preview

Run `python3 -m http.server 4173 --directory public` from this directory, then open http://localhost:4173.

## Publish

Run `firebase deploy --only hosting --project nickbogert-portfolio` from this directory. The Firebase configuration pins deployment to the `nickbogert-portfolio` hosting site. Only `public/` is published.

## Edit

- `public/index.html`: project descriptions, social links, songs, video, and about text.
- `public/style.css`: responsive layout, colors, type, and interaction styles.
- `public/script.js`: keyboard focus for section navigation.
- `public/assets/`: optimized site artwork and project imagery.
- `design/`: original generated hero artwork (not published).

## Content and asset provenance

- Project ownership, app availability, interests, and profile URLs: supplied by Nick.
- Refactor Fitness screenshots: existing project marketing assets in `refactor_fitness/assets/marketing/images/screenshots/`.
- App Store and Google Play links: existing Refactor Fitness marketing site source.
- Anuluna lake image: existing Anuluna website asset.
- Copper & Hearth artwork: https://copperandhearth.com/assets/original-large-v5.jpg
- Song names and IDs: public https://suno.com/@nbogert profile.
- Capybarista thumbnail and video: public https://www.youtube.com/@nsbogert channel, video `4t5ilnSHYzM`.
- Hero collage: original generated artwork. Prompt: monochrome halftone hand releasing cobalt, yellow, and pink paint; street-art collage on a dark background; no text, logos, or specific artist imitation.

The personal copy is an editorial first draft based on Nick's project descriptions and interests. No employment history, commercial metrics, watch ownership claims about particular models, or testimonials were invented. The LinkedIn profile is linked rather than summarized because its public content was unavailable. Music/video links open their original platforms without autoplay or embedded tracking. No contact form, analytics, or visitor data collection is included.

The public refactorfitness.com homepage displayed “Launching Soon” when checked; the portfolio uses Nick's stated live app status and includes direct store links. Custom-domain DNS is managed separately in Cloudflare.

## Launch status — September 30, 2026 (Pacific)

Published and verified at https://nickbogert-portfolio.web.app (HTTP 200).
Desktop and 390px mobile layouts were visually checked, with working anchor navigation and no broken images or horizontal page overflow.

Added `nickbogert.com` as a Firebase custom domain. Cloudflare now has the Firebase-requested A record (`199.36.158.100`), hosting ownership TXT record, and ACME verification TXT record, all DNS only. Firebase was still reporting ownership verification and HTTPS certificate validation pending at the last check. The `www` variant is not configured.

- Intro portrait: Nick’s supplied casual photograph, displayed unchanged with a CSS crop and violet/blue frame.
- About portrait: Nick’s supplied suit photograph. Career history (6 years at Intel; 14 at Amazon) and team details supplied directly by Nick.

## Art wall
Three original AI-assisted collages appear at the bottom of the play section. Generated with the built-in image tool using the existing hero as a style reference; full prompts and PNG originals are in `design/`. Web JPEGs are in `public/assets/art-*.jpg`. Each print links to its full-size image.

The music print now uses DJ turntables and a mixer, reflecting Nick’s past DJing, and is titled “Follow the Music.” The earlier headphones artwork is retained in design history.

About portrait updated to the approved square collage with fully legible “Professional” graffiti. Original: `design/nick-professional-collage.png`; published image: `public/assets/nick-professional-collage.jpg`. Generated with the built-in image tool from Nick’s casual-photo likeness, with a marker-drawn jacket and purple tie. The original suit photo is retained.

## Antagonized
Playable at `/antagonized/`, linked from the Play section. Copied from Nick’s `/Users/nbogert/dev/antagonized/public/` on October 1, 2026; source project is unchanged. The browser game requires no server or database. Portfolio copy omits the original ad slot, adds a return link and accessible control labels, fixes narrow-screen canvas sizing, prevents game keys scrolling the page, and releases held controls on blur. The gameplay preview is an actual browser screenshot of the third-level arena. To update gameplay, reconcile changes from the original `game.js` while retaining those input fixes.

## Search setup — October 2, 2026

- Preferred public address: `https://nickbogert.com/`. Both the custom domain and Firebase hostname serve page-specific canonical tags pointing at this domain.
- Homepage title and description identify Nick Bogert and Refactor Fitness. JSON-LD connects WebSite, ProfilePage, and Person records to Nick’s public profiles; social sharing metadata includes the approved collage portrait.
- `public/robots.txt` permits crawling and points to `public/sitemap.xml`. The sitemap lists the homepage and playable Antagonized page. Update each page’s `lastmod` only when that page materially changes.
- Search Console URL-prefix property `https://nickbogert.com/` verified for Nick’s existing Google account using the homepage verification meta tag. Keep that tag in place.
- Sitemap submitted successfully. Homepage inspection initially reported “URL is unknown to Google”; the indexing request was accepted into Google’s priority crawl queue. This does not confirm indexing or any ranking.
- `www.nickbogert.com` was explicitly authorized in the follow-up and configured in Firebase as a redirect to `nickbogert.com`. Cloudflare CNAME: `www` → `nickbogert-portfolio.web.app`, DNS only, Auto TTL. Both 1.1.1.1 and 8.8.8.8 return the new record. Firebase verified the DNS record and confirmed successful custom-domain setup. Final status: “Minting certificate”; HTTPS redirect awaits certificate activation and is not yet verified. No certificate checks were bypassed.
- Useful next step for authority: add a link to this portfolio from Nick’s LinkedIn, GitHub, and Refactor Fitness founder page. Those external profiles were not modified in this pass.
- Final sitemap status: **Success**, with **2 discovered pages**. Google initially reported a fetch error; after public HTTP/XML verification and one resubmission, it processed the sitemap successfully. Proof: `design/google-sitemap-success.jpg`; homepage crawl-queue confirmation: `design/google-indexing-requested.jpg`.

## Antagonized 3D — October 4, 2026

The Play section now pairs the original Antagonized and Antagonized 3D side by side in
one shared slot, stacking on narrow screens. The 3D preview uses the approved Marin victory artwork from the game, showing
her crown and exterminator outfit. Both its image and play button open
https://d3o8o23ay95f45.cloudfront.net/ in a new tab; the original remains at `/antagonized/`.
The 3D game itself stays on AWS; Firebase publishes only the portfolio link and victory artwork.

## Name search update — October 5, 2026

Added Nicholas Bogert alongside Nick Bogert in the homepage title, search description, and social sharing metadata. The existing Person record keeps Nick Bogert as its name and identifies Nicholas Bogert as alternateName, with givenName and familyName. Updated the homepage sitemap date. No visible page copy, artwork, styling, or behavior changed. Deployed to Firebase and verified the live custom-domain HTML and sitemap match the local files; the page body is byte-for-byte unchanged. Search rankings and crawl timing remain controlled by Google.
