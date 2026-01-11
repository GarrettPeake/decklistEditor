# CLAUDE.md - AI Assistant Guide for Decklist Editor

## Project Overview

**Project Name:** Decklist Editor (decklistEditor)
**Author:** Garrett Peake
**License:** MIT
**Purpose:** A web-based deck editor for managing Magic: The Gathering deck lists with real-time card lookups via Scryfall API.

This is a single-page application (SPA) that enables users to:
- Create and manage multiple card game decks
- Write deck lists in plain text format with auto-parsing
- View card images by hovering over card links
- Access detailed card information via Scryfall
- Persist deck data across sessions using Cloudflare KV storage

## Technology Stack

### Frontend
- **Pure Vanilla JavaScript** - No frameworks (React, Vue, etc.)
- **HTML5** - Minimal semantic structure
- **CSS3** - Flexbox-based responsive layout
- **localStorage** - Client-side caching for Scryfall card data

### Backend
- **Cloudflare Pages** - Static hosting with serverless functions
- **Cloudflare Workers** - Serverless API endpoints
- **Cloudflare KV Store** - Distributed key-value storage
  - Namespace: `DECKLISTEDITOR`
  - Binding ID: `bb576df04a11477f935a3b59ae24ba18`

### External APIs
- **Scryfall API** - Card database and image retrieval
  - Endpoint: `https://api.scryfall.com/cards/named?exact={cardName}`
  - No authentication required
  - Public API with rate limits (respect them)

## Directory Structure

```
/home/user/decklistEditor/
├── index.html              # Main HTML entry point (18 lines)
├── script.js               # Client-side JavaScript (190 lines)
├── styles.css              # Styling (131 lines)
├── package.json            # NPM configuration
├── package-lock.json       # Dependency lock
├── wrangler.toml           # Cloudflare Workers config
├── _routes.json            # API routing for Cloudflare Pages
├── _redirects              # SPA redirect rules
├── .gitignore              # Git ignore (node_modules)
└── functions/
    └── api/
        └── [user].js       # Dynamic serverless endpoint
```

**Total Frontend Code:** ~340 lines (HTML + CSS + JS)

## Key Files & Responsibilities

### `/index.html` (18 lines)
**Purpose:** Single-page application structure

**Key Elements:**
- `#decks` - Left sidebar container for deck list buttons
- `#syncScroll` - Center area with textarea editor and card hover links
  - `#editor` - Main textarea for deck text input
  - `#hovers` - Card links display area
- `#display` - Right panel for card image display

**Important Notes:**
- No build process - served as-is
- Loads `styles.css` and `script.js` directly
- Placeholder text explains usage to users

### `/script.js` (190 lines)
**Purpose:** All client-side application logic

**Global State:**
```javascript
var data = [];              // Array of deck strings
var link_cache = {};        // Scryfall card cache
var selectedDeck = 0;       // Currently active deck index
```

**Core Functions:**

1. **`load()`** - Fetches deck data from `/api{pathname}` and initializes cache
2. **`save()`** - Debounced (500ms) PUT request to persist data
3. **`setDeckList()`** - Renders deck buttons in sidebar
4. **`updateData(newData)`** - Processes textarea input, parses cards (500ms debounce)
5. **`get_card(cardName)`** - Fetches/caches Scryfall card data
6. **`display_card(data)`** - Shows card images on hover
7. **`switchDeck(index)`** - Changes active deck
8. **`start()`** - Entry point: loads data then switches to first deck

**Event Flow:**
```
User types in textarea
  → editor.oninput fires
  → Auto-resizes textarea height
  → updateData(editor.value) [debounced 500ms]
  → setDeckList() updates sidebar
  → save() persists to cloud [debounced 500ms]
```

**Important Patterns:**
- **Debouncing:** Both `updateData()` and `save()` use 500ms debounce timers to prevent excessive API calls
- **Caching:** Scryfall card lookups cached in localStorage (`link_cache`)
- **Async/Await:** Used for all fetch operations
- **Closures:** `switchDeck(index)` returns a function for button onclick handlers

### `/functions/api/[user].js` (24 lines)
**Purpose:** Serverless API endpoint with dynamic user-based routing

**Endpoints:**

1. **GET `/api/{user}`**
   - Retrieves deck data from KV store using `user` as key
   - Initializes with `"[]"` if key doesn't exist
   - Returns JSON array of deck strings

2. **PUT `/api/{user}`**
   - Accepts JSON body containing deck data array
   - Stores in KV with `user` as key
   - Returns 200 on success, 500 on error

**Important Notes:**
- `context.params.user` extracts dynamic route parameter
- `context.env.DECKLISTEDITOR` accesses KV namespace
- No authentication (user isolation via URL path only)

### `/wrangler.toml` (9 lines)
**Purpose:** Cloudflare Workers configuration

**Key Settings:**
- Project name: `deckliststorage`
- Compatibility date: `2023-03-01`
- KV namespace binding: `DECKLISTEDITOR`
- Account ID configured

### `/styles.css` (131 lines)
**Purpose:** Visual styling and layout

**Layout Structure:**
- 4-column flexbox layout:
  - 15vw - Deck list sidebar
  - 20vw - Textarea editor
  - 20vw - Card links/hovers
  - 45vw - Card display area

**Key Classes:**
- `.DeckButton` - Deck selection buttons
- `.CardLink` - Clickable card links
- `.unfoundCard` - Red highlight for cards not found in Scryfall
- `.header` - Section headers (lines starting with `#`)
- `.oneCard` / `.twoCard` - Image sizing for single/double-faced cards

**Theme:**
- Dark color scheme (blacks, grays, purples)
- Custom scrollbar styling
- Fixed viewport-based widths (vw units)

## Development Workflows

### Local Development
```bash
# No build step required - open index.html directly
# OR use wrangler for local serverless testing:
npx wrangler pages dev .
```

### Deployment
```bash
npm run deploy
# Runs: wrangler pages deploy .
```

**Deployment Target:** Cloudflare Pages with automatic function deployment

### Testing User Paths
Access the app via different URL paths to simulate different users:
- `http://localhost:8788/user1` → Stores data under key "user1"
- `http://localhost:8788/garrett` → Stores data under key "garrett"

## Code Conventions & Patterns

### Naming Conventions
- **Variables:** `camelCase` (`selectedDeck`, `updateTimer`, `link_cache`)
- **Functions:** `camelCase` (`switchDeck`, `updateData`, `get_card`)
- **DOM IDs:** `camelCase` (`#editor`, `#decks`, `#syncScroll`)
- **CSS Classes:** `PascalCase` or `camelCase` (`.DeckButton`, `.CardLink`, `.unfoundCard`)

### Code Style
- **No semicolons** - Most lines don't use them (inconsistent)
- **var instead of let/const** - Legacy JavaScript style
- **Minimal comments** - Code is self-documenting
- **No strict mode** - `"use strict"` not used
- **Global scope** - Variables declared at top level

### Anti-Patterns to Maintain
⚠️ **DO NOT "fix" these unless explicitly requested:**
- Using `var` instead of `let`/`const`
- Missing semicolons
- Global variables
- No error handling on fetch calls
- No input validation

**Reason:** This project follows a minimal, vanilla JS philosophy. Keep changes consistent with existing style.

### Best Practices to Follow
✅ **DO follow these patterns:**
- Debounce expensive operations (500ms standard)
- Cache external API calls in localStorage
- Auto-resize textarea based on content
- Use async/await for all fetch operations
- Return functions from higher-order functions for event handlers

## Data Flow & Architecture

### Deck List Format
```
Deck Title (First Line)

#Creatures
4x Grizzly Bears
2x Llanowar Elves

#Spells
3x Lightning Bolt
1x Counterspell
```

**Parsing Rules:**
- **First line:** Deck title (displayed in sidebar button)
- **Lines starting with `#`:** Section headers (styled with `.header`)
- **Card lines:** Optional quantity prefix (`4x`, `2x`) followed by card name
- **Empty lines:** Create spacing in card links display

### Data Persistence Flow
```
User Input
  → data[selectedDeck] updated (immediately)
  → Debounce 500ms
  → PUT /api/{user} with JSON array
  → Cloudflare KV store updated

Page Load
  → GET /api/{user}
  → JSON array returned
  → data global populated
  → switchDeck(0) called
  → UI rendered
```

### Card Lookup Flow
```
User types card name
  → updateData() parses text
  → Extracts card names
  → get_card(cardName) called
    → Check link_cache first
    → If miss: fetch from Scryfall
    → Store in link_cache
    → Save to localStorage
  → Create CardLink element
  → Add hover event listener
  → Display card image on first hover
```

## External Dependencies & APIs

### Scryfall API
**Endpoint:** `https://api.scryfall.com/cards/named?exact={cardName}`

**Response Structure:**
```javascript
{
  "scryfall_uri": "https://scryfall.com/card/...",
  "image_uris": {
    "border_crop": "https://cards.scryfall.io/..."
  },
  "card_faces": [  // For double-faced cards
    {
      "image_uris": {
        "border_crop": "https://..."
      }
    }
  ]
}
```

**Extracted Data:**
```javascript
{
  link: resp["scryfall_uri"],
  imgfront: resp["card_faces"]?.[0]?.["image_uris"]?.["border_crop"]
         || resp["image_uris"]?.["border_crop"],
  imgback: resp["card_faces"]?.[1]?.["image_uris"]?.["border_crop"]
}
```

**Important Notes:**
- **Rate Limits:** Scryfall has rate limits - caching is essential
- **Error Handling:** If card not found, mark with `.unfoundCard` class
- **Card Names:** Must be exact matches (case-sensitive)
- **Double-Faced Cards:** Automatically detected and both sides displayed

### Cloudflare KV Store
**Namespace:** `DECKLISTEDITOR`

**Operations:**
- `get(key)` - Retrieve deck data
- `put(key, value)` - Store deck data

**Data Format:** JSON string of array of strings
```javascript
// Stored in KV
"[\"Deck 1\\n\\n4x Card Name\", \"Deck 2\\n\\n2x Other Card\"]"

// In memory
["Deck 1\n\n4x Card Name", "Deck 2\n\n2x Other Card"]
```

## Important Constraints & Guidelines

### For AI Assistants Working on This Codebase

#### 🚫 DO NOT:
1. **Add frameworks** - No React, Vue, Svelte, etc.
2. **Add build tools** - No Webpack, Vite, Rollup, etc.
3. **Refactor to modern JS** - Keep `var`, no strict mode
4. **Add TypeScript** - Pure JavaScript only
5. **Add linters/formatters** - No ESLint, Prettier configs
6. **Create separate modules** - Keep everything in single files
7. **Add error boundaries** - Minimal error handling is intentional
8. **Add loading states** - Keep UI simple
9. **Add authentication** - User isolation is path-based only
10. **Change debounce timers** - 500ms is intentional

#### ✅ DO:
1. **Maintain vanilla JS patterns** - Use existing code style
2. **Keep files small** - Don't split into modules
3. **Cache external API calls** - Use localStorage
4. **Debounce expensive operations** - Follow 500ms pattern
5. **Test with different user paths** - Simulate multi-user scenarios
6. **Preserve auto-resize behavior** - Textarea height management
7. **Respect Scryfall API** - Use cache, handle failures gracefully
8. **Keep HTML minimal** - Single file, no templating
9. **Use absolute positioning sparingly** - Flexbox is preferred
10. **Document breaking changes** - If changing data structures

#### 🔧 Common Tasks:

**Adding a New Feature:**
1. Read relevant existing code first
2. Add logic to `script.js` (keep in same file)
3. Update HTML if new elements needed
4. Add CSS for styling
5. Test manually in browser
6. Deploy via `npm run deploy`

**Fixing a Bug:**
1. Identify the function responsible (usually in script.js)
2. Add console.log for debugging (keep some for future debugging)
3. Fix inline - don't extract to new functions unless necessary
4. Test with multiple decks and card names
5. Verify Scryfall cache still works

**Modifying API Endpoint:**
1. Edit `/functions/api/[user].js`
2. Maintain GET/PUT pattern
3. Keep KV operations simple
4. Test with wrangler dev locally
5. Deploy and test in production

**Styling Changes:**
1. Edit `styles.css`
2. Maintain 4-column layout proportions
3. Test with long deck names and many cards
4. Ensure scrollbars work properly
5. Keep dark theme consistent

## Git Workflow

### Current Branch
- **Active:** `claude/add-claude-documentation-ca2yM`
- **Main:** Not specified (likely `main` or `master`)

### Commit Style
Looking at git history:
```
0b4c763 - gp - switch to cloudflare pages with functions
c60c022 - put save on timer, shorten refresh timer
660abff - dumb error
```

**Pattern:** Lowercase, descriptive, informal commit messages

### Deployment Process
1. Make changes locally
2. Test manually in browser
3. Commit with descriptive message
4. Push to branch: `git push -u origin claude/add-claude-documentation-ca2yM`
5. Deploy: `npm run deploy`
6. Test deployed version on Cloudflare Pages

## Troubleshooting

### Common Issues

**Cards not loading:**
- Check browser console for Scryfall API errors
- Verify card names are exact matches
- Check localStorage quota (cache might be full)
- Clear `link_cache` in localStorage if corrupt

**Save not working:**
- Check network tab for PUT request failures
- Verify Cloudflare KV namespace is accessible
- Check wrangler.toml configuration
- Ensure 500ms debounce isn't being interrupted

**Layout broken:**
- Verify all 4 main divs are present in HTML
- Check viewport width calculations in CSS
- Test at different screen sizes
- Check for conflicting CSS rules

**User data mixing:**
- Verify URL path is different for each user
- Check KV store keys (should be unique per path)
- Test with `/api/test1` vs `/api/test2`

## Performance Considerations

### Optimization Strategies
1. **Debouncing:** 500ms prevents excessive saves and renders
2. **Caching:** localStorage reduces Scryfall API calls
3. **Lazy Loading:** Cards only fetched when parsed
4. **Minimal DOM:** Simple structure, few elements
5. **No Dependencies:** Zero npm packages in production

### Scaling Limits
- **Deck Size:** No hard limit, but large decks slow down parsing
- **Deck Count:** No limit, but UI doesn't paginate
- **User Count:** Limited by Cloudflare KV (very high)
- **Scryfall API:** Rate limited - caching is critical

## Additional Resources

### Cloudflare Documentation
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Workers KV](https://developers.cloudflare.com/kv/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Scryfall API
- [API Documentation](https://scryfall.com/docs/api)
- [Card Objects](https://scryfall.com/docs/api/cards)
- [Rate Limiting](https://scryfall.com/docs/api#rate-limits-and-good-citizenship)

### Magic: The Gathering
- [Scryfall Card Search](https://scryfall.com/)
- Understanding card names and formats helps with testing

## Version History

**Current State (as of 2026-01-11):**
- Cloudflare Pages with Functions architecture
- 500ms debounce timers for save and update
- localStorage caching for Scryfall
- Multi-deck support with sidebar navigation
- Auto-sizing textarea
- Hover-based card image display

**Recent Changes:**
- Migrated to Cloudflare Pages from previous backend
- Added save timer debouncing
- Shortened refresh timer
- Added SPA redirect file
- Implemented auth switching (user path-based)

---

## Quick Reference

### File Locations
- Frontend: `index.html`, `script.js`, `styles.css`
- Backend: `functions/api/[user].js`
- Config: `wrangler.toml`, `_routes.json`, `_redirects`

### Key Functions
- `load()` - Initialize from API
- `save()` - Persist to KV (debounced)
- `updateData()` - Parse deck text (debounced)
- `get_card()` - Fetch from Scryfall (cached)
- `switchDeck()` - Change active deck

### Important IDs
- `#editor` - Main textarea
- `#decks` - Deck list sidebar
- `#hovers` - Card links area
- `#display` - Card image display

### Deploy Command
```bash
npm run deploy  # wrangler pages deploy .
```

---

**Remember:** This is a minimal, vanilla JavaScript project. Resist the urge to add frameworks, build tools, or over-engineer solutions. Simplicity is a feature, not a bug.
