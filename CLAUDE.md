# Decklist Editor - Comprehensive Repository Overview

## Project Summary

Decklist Editor is a web-based application for creating, managing, and organizing Magic: The Gathering deck lists. Built as a Cloudflare Worker application, it provides a seamless interface for users to create multiple decks, view card information from Scryfall, and automatically save their work using Cloudflare KV storage.

**Author**: Garrett Peake
**License**: MIT
**Version**: 1.6.0

## Architecture Overview

### Technology Stack

- **Backend**: Cloudflare Workers (serverless edge computing)
- **Storage**: Cloudflare KV (key-value storage)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Deployment**: Wrangler CLI
- **External API**: Scryfall API for card data

### Application Structure

```
decklistEditor/
├── src/
│   ├── index.js          # Cloudflare Worker entry point
│   └── accounts/         # Accounts + protected links (TypeScript; see its README.md)
├── migrations/           # D1 (accounts) migrations
├── scripts/              # migrate-legacy-accounts.mjs, link-gauth.mjs
├── test/                 # vitest: accounts against SQLite
└── public/               # The site: ONLY this directory is served
    ├── index.html
    ├── js/accounts/      # Accounts in the browser: accounts.js, dialog.js, accounts.css
    └── (js/ and styles/ below live here too)
├── js/                   # Frontend ES modules (public/js)
│   ├── main.js           # Entry point, orchestrates initialization
│   ├── state.js          # Application state and configuration
│   ├── dom.js            # Centralized DOM element references
│   ├── api.js            # API calls (load, save, share, Scryfall, auth)
│   ├── auth.js           # Decklister's account UI (Protect / Log in / Log out, locked links)
│   ├── router.js         # URL parsing and history management
│   ├── deckList.js       # Deck list rendering and switching
│   ├── cardDisplay.js    # Card preview and Scryfall integration
│   ├── autocomplete.js   # Card name autocomplete functionality
│   ├── resizer.js        # Panel resize functionality
│   ├── landing.js        # Landing page setup
│   └── mobile.js         # Mobile-specific UI handlers
├── styles/               # Modular CSS
│   ├── main.css          # Entry point, imports all modules
│   ├── variables.css     # CSS custom properties (design tokens)
│   ├── base.css          # Reset, typography, scrollbars
│   ├── layout.css        # Grid overlay, app container
│   ├── header.css        # Desktop and mobile headers
│   ├── sidebar.css       # Sidebar, deck list, deck items
│   ├── buttons.css       # All button styles
│   ├── editor.css        # Editor textarea and wrapper
│   ├── card-links.css    # Stacked card design
│   ├── card-display.css  # Card preview area
│   ├── modal.css         # Share modal
│   ├── autocomplete.css  # Autocomplete dropdown
│   ├── landing.css       # Landing page
│   ├── resize.css        # Resize handles
│   ├── auth.css          # Auth modal and buttons
│   ├── share-mode.css    # Read-only view overrides
│   └── responsive.css    # All media queries
├── index.html            # Main application UI
├── script.js             # Legacy frontend (deprecated)
├── styles.css            # Legacy styles (deprecated)
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Node.js project configuration
└── .gitignore            # Git ignore rules
```

**Note**: The site lives in `public/` (`public/index.html`, `public/js/`, `public/styles/`). Only `public/` is served; before 2026-11 the assets directory was the repo root, which published CLAUDE.md, src/ and wrangler.toml.

## Component Details

### 1. Cloudflare Worker (`src/index.js`)

The Worker serves as the backend API and static asset server.

**Key Features**:
- Handles API routes under `/api/{user}`, `/api/share`, and the account routes (`/api/auth/*`, `/api/account*`, `/auth/*`, from `src/accounts`)
- Manages GET and PUT requests for user deck data
- Manages deck sharing with live references
- Optional accounts (`src/accounts`, see its README.md): username/password or GAuth, and protected links that open only in their owner's session
- Integrates with Cloudflare KV for persistent storage
- Auto-migrates legacy data formats
- Serves static assets (HTML, CSS, JS) for all other routes

**API Endpoints**:

- `GET /api/{user}`: Retrieves user's deck data from KV storage
  - Stores data with `user:` prefix (e.g., `user:garrett`)
  - Returns array of `{id, text}` deck objects
  - Auto-migrates old format (string arrays) to new format
  - Automatically initializes storage for new users

- `PUT /api/{user}`: Saves user's deck data to KV storage
  - Accepts JSON-stringified deck array in request body
  - Stores with `user:` prefix
  - Returns saved data on success

- `POST /api/share`: Creates a new share link
  - Accepts `{user, deckId}` in request body
  - Generates UUID and stores reference as `share:{uuid}`
  - Returns `{uuid}` for constructing share URL

- `GET /api/share/{uuid}`: Retrieves shared deck content
  - Resolves reference to fetch live deck data
  - Returns only deck text (user identity not exposed)
  - Handles both old format (plain text) and new format (references)

- Account routes (`src/accounts/README.md` has the details):
  - `/api/auth/*`: Better Auth (`sign-in/username`, `sign-up/email`, `sign-in/discover`, `sign-out`, GAuth's SAML)
  - `GET /api/account`: who's signed in and the links they protect
  - `POST /api/account/links {id}`: protect a link with the signed-in account
  - `GET /auth/gauth?next=`: sign in with GAuth, back to `next`
- `GET`/`PUT /api/{user}` and `POST /api/share` check `accounts.access()`: a protected link answers 401/403 `{protected: true}` unless the request carries its owner's session. `GET` sets `X-Link-Protected: 1|0`.

**KV Key Patterns**:
- `user:{uuid}` - User's deck list (array of `{id, text}` objects)
- `share:{uuid}` - Share reference (`{user, deckId}`) or legacy plain text
- `account:{username}`, `uuid-account:{uuid}` - The accounts made before 2026-11 (JWT era). No longer read: `scripts/migrate-legacy-accounts.mjs` moved them into D1 (same passwords, same protected links). Left in place, unchanged.

**D1 (`DB`, database `decklister`)**: Better Auth's tables (`user`, `session`, `account`, ...) and `protectedLink (id, userId, createdAt)`. Decks stay in KV.

**Data Migration** (src/index.js:82-116):
- Checks for new `user:` prefixed key first
- Falls back to legacy unprefixed key
- Detects old format (string array) vs new format (object array)
- Auto-assigns UUIDs to migrated decks
- Saves migrated data with new prefix

**New User Initialization** (src/index.js:111-133):
- New users are initialized with a "Sample Deck" containing example cards
- Sample deck includes sections: Creatures, Lands, Artifacts, Enchantments, Spells
- Helps new users understand the deck format and see the app's features immediately

### 2. Frontend Application (`js/` modules)

The frontend is organized into ES modules for maintainability. Each module has a single responsibility.

#### Module Overview

| Module | Purpose |
|--------|---------|
| `main.js` | Entry point, orchestrates initialization |
| `state.js` | Application state and helper functions |
| `dom.js` | Centralized DOM element references |
| `api.js` | API calls (load, save, share, Scryfall, auth) |
| `auth.js` | Authentication UI modal and handlers |
| `router.js` | URL parsing and history management |
| `deckList.js` | Deck list rendering and switching |
| `cardDisplay.js` | Card preview and connection line |
| `autocomplete.js` | Card name autocomplete functionality |
| `resizer.js` | Panel resize functionality |
| `landing.js` | Landing page setup |
| `mobile.js` | Mobile-specific UI handlers |

#### State Module (`js/state.js`)

**Core State Variables** (exported):
- `data`: Array of deck objects `{id: string, text: string}` (plain strings in share mode)
- `link_cache`: Object caching Scryfall card lookups
- `selectedDeck`: Index of currently active deck
- `isMobile`: Boolean tracking viewport width (≤768px)
- `isRenderMode`: Boolean for mobile render/edit mode toggle
- `isShareMode`: Boolean for read-only share view (const)
- `shareId`: UUID from share URL path (const)
- `currentUser`: UUID parsed from URL (const)
- `initialDeckId`: Deck ID parsed from URL for deep linking (const)
- `isLandingPage`: Boolean for landing page detection (const)

**Account State Variables**:
- `account`: `GET /api/account`'s answer (`{ signedIn, user, links }`)
- `linkProtected`: whether this link is protected (from `X-Link-Protected`)

**Autocomplete State Variables**:
- `autocompleteResults`: Array of current search results from Scryfall
- `autocompleteSelectedIndex`: Explicitly selected index via arrow keys (-1 = none)
- `autocompleteTimer`: Debounce timer for API calls (300ms delay)
- `autocompleteVisible`: Boolean for dropdown visibility state
- `lastCursorPosition`: Tracks cursor position to detect movement
- `autocompleteAbortController`: AbortController for canceling pending API requests
- `lastEditorValue`: Tracks editor content to only trigger autocomplete on actual text changes

**State Setters**: Each mutable state variable has a corresponding setter function (e.g., `setData()`, `setSelectedDeck()`)

**Helper Functions**:
- `getDeckText(index)`: Helper to get deck text (handles both modes)
- `getDeckId(index)`: Helper to get deck UUID

#### API Module (`js/api.js`)

- `load()`: Fetches user/share data from API on startup; returns `{locked, otherAccount}` for a protected decklist that isn't this session's. Puts back edits a save couldn't store (session ended mid-edit).
- `save()`: Debounced save to API (500ms delay). A 401/403 keeps the edit in sessionStorage and calls the `setOnLocked` handler (sign in again).
- `shareDeck()`: Creates share link via API, returns URL
- `getCard(cardName)`: Fetches card data from Scryfall API

#### Auth Module (`js/auth.js`)

Decklister's use of the shared accounts module (`js/accounts/`):
- `handleLocked({otherAccount, error})`: a protected link: GAuth again by itself if this browser's GAuth session expired, else the sign-in dialog
- `protectThisLink()`: the Protect button (dialog when signed out)
- `finishPendingProtect()`: back from GAuth, protect the link this tab set off to protect
- `updateAuthUI()` / `initAuth()`: header and mobile buttons
- `initLandingAccount()`, `newLink()`: the landing page's account part (Log in, the account's links, `/?signed-in`)

#### Router Module (`js/router.js`)

- `updateUrl(deckId)`: Updates browser URL via history.pushState
- `initRouter()`: Sets up popstate listener for back/forward
- `setInitialUrlState()`: Sets initial history state after load

#### Deck List Module (`js/deckList.js`)

- `setDeckList()`: Renders deck selection with share button
- `switchDeck(index)`: Returns function that changes active deck; handles empty decks state by disabling editor and showing "Add a new deck to start editing" message
- `shareDeck()`: Shows share modal with generated URL
- `copyShareUrl()`: Copies share URL to clipboard

#### Card Display Module (`js/cardDisplay.js`)

- `displayCard(cardData)`: Returns function that shows card images
- `showConnectionLine(cardElement)`: Shows line from card to display
- `hideConnectionLine()`: Hides connection line and card preview
- `updateData(newData)`: Parses deck text and displays card links (debounced)

#### Autocomplete Module (`js/autocomplete.js`)

- `getCurrentLineInfo()`: Returns current line text, position, and cursor info
- `parseCardNameFromLine(lineText)`: Extracts card name, stripping quantity prefix
- `searchScryfall(query)`: Fetches card search results from Scryfall API
- `calculateDropdownPosition()`: Calculates dropdown position based on cursor; automatically positions above cursor when near viewport bottom
- `showAutocomplete(results)`: Displays autocomplete dropdown with results
- `hideAutocomplete()`: Hides dropdown and cancels pending requests
- `updateAutocompleteSelection(index)`: Updates visual selection in dropdown
- `selectAutocomplete(index)`: Inserts selected card name into editor
- `triggerAutocomplete()`: Debounced trigger for autocomplete search
- `handleAutocompleteKeydown(e)`: Handles keyboard navigation
- `checkCursorMovement()`: Detects cursor movement to hide autocomplete
- `initAutocomplete()`: Sets up all autocomplete event listeners

#### Resizer Module (`js/resizer.js`)

- `loadPanelSizes()`: Loads saved panel sizes from localStorage (sidebar width, display width, mobile card height)
- `savePanelSizes()`: Saves panel sizes to localStorage
- `initResizers()`: Sets up resize handlers for sidebar, display, and mobile render resizers
- `applyMobileRenderHeight()`: Applies saved mobile card display height when entering render mode
- `resetMobileRenderHeight()`: Resets mobile card display height when exiting render mode

**Resize Behavior**:
- **Sidebar resizer**: Controls sidebar width in pixels (150-400px range)
- **Display resizer**: Controls card display panel width in pixels (200-600px range)
- **Mobile render resizer**: Controls card display height in mobile render mode (vertical drag)
- Editor and card links panels split remaining space equally (flex: 1)

#### Landing Module (`js/landing.js`)

- `handleLogoClick(e)`: Sets flag for intentional navigation home
- `hasRedirectParam()`: Checks for protected decklist redirect in URL
- `setupLandingPage()`: Shows landing page or redirects returning users; handles protected redirect flow
- `initLogoHandlers()`: Sets up logo click handlers

#### Mobile Module (`js/mobile.js`)

- `closeMobileMenu()`: Closes mobile dropdown menu
- `updateRenderToggleIcon()`: Updates mobile toggle button icon
- `initMobileHandlers()`: Sets up all mobile-specific handlers

**URL Routing**:
- Parses `/{user}` and `/{user}/{deckId}` patterns
- Deep links to specific decks via UUID in URL
- Updates URL when switching decks (history.pushState)
- Handles browser back/forward with popstate listener

**Share Mode**:
- Detected via `/share/{uuid}` URL pattern
- Fetches deck content from `/api/share/{uuid}`
- Displays read-only view (no editor, no sidebar)
- Shows live deck content (always current version)

**User Interactions**:
- Text editing triggers automatic deck parsing and save
- Card names are auto-linked to Scryfall pages
- **Desktop**: Hover over card names to display images, click to open Scryfall
- **Mobile**: Tap card names to display images, tap images to open Scryfall

**Autocomplete Interactions**:
- Typing 3+ characters triggers autocomplete dropdown (after 300ms debounce)
- **Tab**: Selects first/highlighted suggestion
- **Up/Down arrows**: Navigate through suggestions
- **Enter** (with selection): Selects highlighted suggestion
- **Enter** (no selection): Adds newline, hides autocomplete
- **Escape**: Hides autocomplete without selecting
- **Click outside**: Hides autocomplete
- Cursor movement to different line hides autocomplete
- Shows card name and mana cost in dropdown (first 10 results, 5 visible with scroll)

### 3. User Interface (`index.html`)

**Desktop Layout** (4-panel):
1. **Collapsible Sidebar** (`.sidebar`): Deck list with add/share/delete buttons, inline hamburger toggle button
   - Resize handle on right edge (controls sidebar width in px)
2. **Text Editor** (`.editor-textarea`): Deck text input area (flex: 1, shares space with card links)
3. **Card Links** (`.card-links`): Rendered card list with Scryfall links (flex: 1, shares space with editor)
4. **Card Display** (`.card-display`): Card image preview area
   - Resize handle on left edge (controls display width in px)

**Mobile Layout** (≤768px):
1. **Header Bar** (`.mobile-header`): Title and hamburger menu button
2. **Dropdown Menu** (`.mobile-dropdown`): Deck selection dropdown from header
3. **Content Area**: Either editor (default) or rendered view
4. **Render Toggle** (`.render-toggle`): Floating button to switch between edit/render modes

**Share Mode Layout**:
- Sidebar hidden (desktop)
- Mobile header/dropdown hidden
- Editor hidden
- Card links and display shown in read-only mode

**Share Modal** (index.html:55-66):
- Overlay modal for displaying share URL
- Copy button with "Copied!" feedback
- Close button and click-outside-to-close

**Mobile Render Mode**:
- Top portion shows card art display (default 30vh, resizable)
- Bottom portion shows rendered card list
- Horizontal resize handle between panels (drag to adjust split)
- Tap card name to show its art
- Tap card art to open Scryfall

**Editor Features** (index.html:38-39):
- Spellcheck disabled for card names
- Placeholder instructions for new users
- Auto-expanding textarea based on content

**Autocomplete Container** (index.html:93-96):
- Positioned absolutely within `.editor-wrapper`
- Contains `ul.autocomplete-list` for suggestion items
- Hidden by default, shown via `.visible` class

**Asset Paths**:
- CSS uses absolute path (`/styles/main.css`)
- JS uses absolute path with module type (`/js/main.js`)
- Required for nested routes like `/share/{uuid}` and `/{user}/{deckId}`

### 4. Styling (`styles/` modules)

The CSS is organized into focused modules using CSS `@import`. Each module has a single responsibility.

#### CSS Module Overview

| Module | Purpose |
|--------|---------|
| `main.css` | Entry point, imports all modules |
| `variables.css` | CSS custom properties (design tokens) |
| `base.css` | Reset, typography, scrollbars |
| `layout.css` | Grid overlay, app container, connection line |
| `header.css` | Desktop and mobile headers |
| `sidebar.css` | Sidebar, deck list (with scrollable items container), deck items |
| `buttons.css` | All button styles |
| `editor.css` | Editor textarea and wrapper |
| `card-links.css` | Stacked card design |
| `card-display.css` | Card preview area |
| `modal.css` | Share modal |
| `autocomplete.css` | Autocomplete dropdown |
| `landing.css` | Landing page |
| `resize.css` | Resize handles |
| `auth.css` | Header account buttons, Protected badge, landing account list |
| `share-mode.css` | Read-only view overrides |
| `responsive.css` | All media queries |

#### CSS Custom Properties (`styles/variables.css`)

- `--black`, `--near-black`, `--dark-gray`, `--gray`, `--light-gray`, `--white`: Color scale
- `--orange`, `--cyan`, `--green`, `--yellow`, `--danger`: Accent colors
- `--grid-color`, `--grid-border`: Blueprint grid styling
- `--transition-fast`, `--transition-normal`: Animation timing
- `--radius-sm`, `--radius-md`, `--radius-lg`: Border radius values
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`: Box shadow values
- `--header-height`: Header height (52px)

#### Design Characteristics

- Neo-brutalist dark theme with CSS variables
- Flexbox-based responsive layout
- Blueprint grid overlay effect
- Smooth transitions and subtle shadows
- Custom WebKit scrollbar styling
- JetBrains Mono and Inter font stack

#### Key Component Styles

**Share Modal** (`styles/modal.css`):
- Dark overlay background
- Centered modal with shadow
- Monospace font for URL input
- Copy button with accent color

**Share Mode** (`styles/share-mode.css`):
- Hides sidebar, header, editor wrapper
- Full-width card links panel

**Autocomplete** (`styles/autocomplete.css`):
- `.autocomplete-container`: Absolute positioned dropdown with cyan border
- `.autocomplete-list`: Scrollable list (max-height 200px, ~5 visible items)
- `.autocomplete-item`: Individual suggestions with hover/selected states
- `.position-above`: Modifier class for positioning dropdown above cursor when near viewport bottom

**Sidebar** (`styles/sidebar.css`):
- `.deck-list-header`: Flex container for Add Deck button and toggle button
- `.deck-list-items`: Scrollable container for deck items
- `.sidebar-toggle-btn`: Inline hamburger toggle button (square, same height as Add Deck)

**Resize Handles** (`styles/resize.css`):
- `.resize-handle`: Base style with light box appearance and three-dot indicator
- `.resize-dots`: Vertical dots by default, `.horizontal` modifier for horizontal orientation
- `.sidebar-resizer`: Positioned on right edge of sidebar
- `.display-resizer`: Positioned on left edge of card display
- `.mobile-render-resizer`: Horizontal handle between card display and card links (mobile only)

**Account Buttons** (`styles/auth.css`; the sign-in dialog is `js/accounts/accounts.css`):
- `.protected-badge`: green "Protected" in the header for the link's owner
- `.landing-account`, `.landing-links`: the landing page's list of an account's links
- `.header-auth`: Flex container for desktop header auth buttons
- `.auth-btn`: Header button with icon, `.primary` modifier for orange background
- `.username-display`: Shows logged-in username with icon
- `.mobile-auth-section`: Mobile dropdown auth buttons
- `.landing-login-btn`: Secondary button on landing page

#### Responsive Breakpoints (`styles/responsive.css`)

- **Mobile** (≤768px): Single column, header with dropdown, floating render toggle
- **Tablet** (769-1024px): Narrower sidebar (200px), adjusted proportions
- **Desktop** (>1024px): Full 4-column layout with collapsible sidebar (240px)
- **Large Desktop** (≥1400px): Wider sidebar (280px), increased padding

### 5. Cloudflare Configuration (`wrangler.toml`)

See `wrangler.toml`. The main points:
- **Assets**: only `public/` is served. `run_worker_first` covers `/api/*` and `/auth/*`.
- **KV** `DECKLISTEDITOR`: decks and shares.
- **D1** `DB` (`decklister`): accounts and protected links (`migrations/`).
- **Vars**: `APP_ORIGIN` (`https://decklister.gpeake.com`, the one address; other hosts redirect there), `GAUTH_ORIGIN`, `GAUTH_CERTS`.
- **Secret**: `BETTER_AUTH_SECRET`.
- **Custom domain**: decklister.gpeake.com is attached in the dashboard, not as `routes` (which make `wrangler dev` rewrite Host and Origin).

## Data Flow

### Loading Process

1. User navigates to `/{username}` or `/{username}/{deckId}`
2. `script.js` starts, parses URL for user and optional deckId
3. Frontend fetches `/api/{username}`
4. Worker retrieves data from `user:{username}` KV key
5. If legacy format found, auto-migrates to new format
6. Frontend populates deck list and editor
7. If deckId in URL, selects that deck; otherwise selects first
8. URL updated via history.replaceState with current deck ID
9. Link cache loaded from localStorage

### Saving Process

1. User edits deck text in textarea
2. `oninput` event triggers
3. Deck object's `text` property updated
4. 500ms debounced `save()` queues API PUT request
5. Data sent to `/api/{username}`
6. Worker stores JSON in `user:{username}` KV key
7. Link cache saved to localStorage

### Sharing Process

1. User clicks "Share Deck" button
2. Frontend POSTs `{user, deckId}` to `/api/share`
3. Worker generates UUID, stores reference in `share:{uuid}`
4. Worker returns `{uuid}` to frontend
5. Frontend displays modal with full share URL

### Viewing Shared Deck

1. User navigates to `/share/{uuid}`
2. Frontend detects share mode, applies share-mode class
3. Frontend fetches `/api/share/{uuid}`
4. Worker looks up `share:{uuid}` → gets `{user, deckId}`
5. Worker fetches `user:{user}` → finds deck by ID
6. Worker returns deck text only (user not exposed)
7. Frontend displays read-only view with current deck content

### Card Lookup Process

1. User types card name (e.g., "4x Lightning Bolt")
2. `updateData()` parses quantity and card name
3. `get_card()` checks link_cache first
4. If not cached, fetches from Scryfall API
5. Caches response (link, front image, back image)
6. Updates UI with clickable link and hover preview

## Features

### Deck Management
- Create unlimited decks per user
- Each deck has a unique UUID
- Switch between decks with sidebar buttons
- Delete decks with confirmation prompt
- Auto-save every 500ms after editing
- Bookmarkable URLs for each deck (`/{user}/{deckId}`)
- New users start with a sample deck showing all features
- Empty state: editor disabled with "Add a new deck to start editing" message when all decks are deleted

### Deck Sharing
- Generate shareable read-only links
- Share links show live deck content (always current version)
- User identity not exposed in share links
- Copy-to-clipboard functionality
- Clean read-only view for shared decks

### Card Display
- Automatic Scryfall integration
- Quantity parsing (e.g., "4x Card Name")
- Section headers with `#` prefix
- Double-faced card support
- Hover to preview, click to open Scryfall page
- Visual indicators for unfound cards (red text)

### Autocomplete
- Non-intrusive autocomplete in editor (triggers after 3+ characters)
- Shows card name and mana cost from Scryfall search API
- Keyboard navigation: Tab (select first), Up/Down (navigate), Enter (select/newline), Escape (close)
- Preserves quantity prefix when selecting (e.g., "4x " stays)
- Debounced API requests (300ms) to prevent rate limiting
- Auto-hides on cursor movement, newline, or click outside

### Data Persistence
- User-scoped storage via URL path
- Edge-cached KV storage for low latency
- LocalStorage caching for Scryfall lookups
- Automatic initialization for new users
- Non-destructive migration for legacy data

## Development

### Deployment

**Pushing to `master` deploys**: Cloudflare Workers Builds builds and deploys every push.
It doesn't apply D1 migrations, so apply a new migration before pushing the code that
needs it (`npx wrangler d1 migrations apply decklister --remote`).

```bash
npm run deploy   # by hand: tsc, tests, remote D1 migrations, wrangler deploy
```

### Tests

```bash
npm test         # vitest: src/accounts against SQLite (test/d1.ts)
npx tsc          # typecheck src/**/*.ts
```

### Local Development

`.dev.vars` (gitignored) sets `APP_ORIGIN=http://127.0.0.1:8789`, a local `BETTER_AUTH_SECRET`, and a local GAuth (`pnpm dev` in ~/Projects/GAuth, port 8797) with its certificate. Then:

```bash
npx wrangler d1 migrations apply decklister --local
npm run dev      # wrangler dev on 127.0.0.1:8789
```

The local GAuth needs Decklister registered (entity ID `http://127.0.0.1:8789/api/auth/sso/saml2/sp/metadata?providerId=gauth`, ACS `.../sp/acs/gauth`).

## Technical Notes

### Performance Optimizations

- **Debounced Saves**: 500ms delay prevents excessive API calls
- **Debounced Parsing**: 500ms delay for card link updates
- **Link Caching**: LocalStorage prevents redundant Scryfall API calls
- **Edge Computing**: Cloudflare Workers provide global low-latency access
- **Debounced Autocomplete**: 300ms delay prevents excessive Scryfall API calls during typing
- **Request Cancellation**: Uses AbortController to cancel pending autocomplete requests when new input arrives

### Browser Compatibility

- Modern browsers with ES6+ support required
- Uses native ES modules (`<script type="module">`) - no build step required
- Uses CSS `@import` for modular stylesheets
- Uses Fetch API (no polyfills included)
- Uses `crypto.randomUUID()` for deck IDs
- Uses History API for URL management
- Flexbox-based responsive layout
- Custom scrollbar styling (WebKit only)
- Mobile-responsive with touch interactions
- Tested breakpoints: 768px (mobile), 1024px (tablet), 1400px (large desktop)

### Security Considerations

- **Secret links**: an unprotected decklist is readable and writable by anyone with its URL (the URL is the secret).
- **Protected links**: anyone holding an unclaimed link can protect it with an account; then it opens only in that account's session. See `src/accounts/README.md`.
- **Accounts**: username/password (PBKDF2-SHA256, 100k iterations, via WebCrypto; 30-day sessions) or GAuth (passkeys over SAML; 12-hour sessions). Never both on one account; password sign-in refuses GAuth accounts.
- **Sessions**: Better Auth cookies (HttpOnly, host-only). No tokens in localStorage.
- **CSRF**: writes from another origin are refused (`accounts.crossOriginPost`); only GAuth's ACS post is exempt.
- Share links do not expose user identity (remain public even for protected decklists); only the owner can create them for a protected link.
- No input sanitization on deck names

### Data Migration

The system automatically handles legacy data:
- Old KV keys without `user:` prefix are migrated
- Old deck format (string arrays) migrated to object arrays with UUIDs
- Old share format (plain text) still supported for reading
- Migration is non-destructive (original data preserved during transition)

## API Dependencies

### Scryfall API

The application uses two Scryfall API endpoints:

#### Card Lookup (Exact Match)
**Endpoint**: `https://api.scryfall.com/cards/named?exact={cardName}`

**Response Structure** (relevant fields):
```json
{
  "scryfall_uri": "https://scryfall.com/card/...",
  "image_uris": {
    "border_crop": "https://..."
  },
  "card_faces": [
    {
      "image_uris": {
        "border_crop": "https://..."
      }
    }
  ]
}
```

**Usage Pattern**:
- Single-faced cards: `image_uris.border_crop`
- Double-faced cards: `card_faces[0].image_uris.border_crop` and `card_faces[1].image_uris.border_crop`

#### Card Search (Autocomplete)
**Endpoint**: `https://api.scryfall.com/cards/search?q={query}`

**Response Structure** (relevant fields):
```json
{
  "data": [
    {
      "name": "Lightning Bolt",
      "mana_cost": "{R}"
    }
  ]
}
```

**Usage Pattern**:
- Returns first 10 results for autocomplete dropdown
- Displays card name and mana cost
- Uses debouncing (300ms) to avoid spamming the API
- Uses AbortController to cancel pending requests on new input

**Rate Limiting Note**: Scryfall requests that applications limit requests to 10 per second. The 300ms debounce and request cancellation help ensure compliance with this guideline. Future enhancements should maintain this rate limiting approach.

## User Workflow

### Desktop Workflow
1. Navigate to `https://yourworker.workers.dev/{username}`
2. Click "+ Add Deck" to create first deck
3. Type deck name on first line
4. Add cards line by line (optional quantity prefix)
5. Add section headers with `#` prefix
6. Hover over card names to preview images
7. Click card links to view on Scryfall
8. Use sidebar toggle (chevron) to collapse/expand deck list
9. Switch decks using sidebar buttons (URL updates automatically)
10. Bookmark specific decks via URL (`/{user}/{deckId}`)
11. Click "Share Deck" to generate shareable link
12. Delete unwanted decks with confirmation

### Mobile Workflow
1. Navigate to `https://yourworker.workers.dev/{username}`
2. Tap hamburger menu (top right) to open deck dropdown
3. Select a deck or tap "+ Add Deck"
4. Edit deck text in the editor (default view)
5. Tap floating grid button (bottom right) to switch to render mode
6. In render mode: tap card names to show art, tap art to open Scryfall
7. Tap pencil button to return to edit mode
8. Tap "Share Deck" in dropdown to generate shareable link

### Sharing Workflow
1. Open deck you want to share
2. Click/tap "Share Deck" button
3. Modal appears with shareable URL
4. Click "Copy" to copy URL to clipboard
5. Share URL with others
6. Recipients see read-only view with current deck content

### Authentication Workflow

**Protecting a Decklist**:
1. On your decklist page (`/{uuid}`), click "Protect" in the header
2. Signed in already: it's protected straight away. Otherwise the dialog asks for a username or email:
   - a username: sign in with its password
   - "Create an account": a username (3-30 letters, numbers, underscores) and a password (8+)
   - the email of a GAuth account here: off to GAuth, and back to the page, protected
3. From then on the link opens only when signed in to that account; the bookmark warning goes

**Logging In**: "Log in" on the landing page or in the header. From the landing page you land on your decklist (or a list, if the account protects several).

**Protected Decklist Access**: opening a protected link without its owner's session shows the sign-in dialog over the page (a GAuth account whose session expired goes back through GAuth by itself, without clicks). Signed in as someone else: the dialog offers to sign out.

**Logging Out**: "Log out" in the header ends the session and returns to the landing page. It also stops the automatic GAuth sign-in until the next sign-in.

## Deck Format Example

```
My Burn Deck
#Creatures
4x Monastery Swiftspear
4x Soul-Scar Mage

#Spells
4x Lightning Bolt
4x Lava Spike
4x Rift Bolt

#Lands
20x Mountain
```

## URL Patterns

| Pattern | Description |
|---------|-------------|
| `/{user}` | User's deck list, shows first deck |
| `/{user}/{deckId}` | User's deck list, shows specific deck |
| `/share/{shareId}` | Read-only view of shared deck |

## Future Enhancement Opportunities

- Export to various formats (MTGO, Arena, text)
- Import from popular deck sites
- Deck statistics (mana curve, color distribution)
- Card price integration
- Drag-and-drop deck reordering
- Deck categorization and search
- Collaborative deck editing
- Enhanced autocomplete with card images/previews
- Autocomplete filtering by card type, color, format legality
- Per-IP rate limiting on auth endpoints
- Password reset functionality

## Troubleshooting

### Common Issues

**Deck not saving**:
- Check browser console for API errors
- Verify KV namespace is correctly bound
- Ensure network connectivity

**Cards not displaying**:
- Verify Scryfall API is accessible
- Check card name spelling (exact match required)
- Clear localStorage cache if stale

**Layout issues**:
- Desktop: Use sidebar toggle if content feels cramped
- Mobile: Use render toggle button to switch between edit/view modes
- Check browser developer tools for CSS errors
- Ensure viewport meta tag is present for proper mobile scaling

**Share link not working**:
- Verify the shared deck still exists
- Check if deck was deleted after sharing
- Ensure CSS/JS loading (paths should be absolute)

**URL not updating**:
- Check browser console for history API errors
- Verify deck has valid UUID

**Authentication issues**:
- **Can't access protected decklist**: Ensure you're logged in with the correct account
- **Login fails**: Verify username and password; check for typos
- **Registration fails**: Username may already be taken; try a different one
- **Session expired**: sign in again (password sessions last 30 days, GAuth sessions 12 hours); edits made meanwhile are kept and saved after signing in
- **"This decklist is protected" dialog**: sign in as the account that protects it

## Repository History

Recent commits show:
- Accounts on Better Auth + D1 (`src/accounts`): username/password or GAuth, any account protects any number of links, legacy accounts migrated; site moved to `public/` (2026-11)
- Optional user authentication with JWT tokens, PBKDF2 password hashing, protected decklists (v1.6.0)
- New user onboarding with sample deck, empty decks state handling with disabled editor (v1.5.0)
- Improved resize handles with visual dot indicators, sidebar/display px-based resizing, mobile render resizer (v1.4.0)
- Overflow fixes: sidebar deck list scrolling, autocomplete position-above, share mode layout (v1.3.1)
- Modular ES modules refactor for JS and CSS (v1.3.0)
- Scryfall search API autocomplete in editor (v1.2.0)
- Deck sharing feature with live references
- Deck UUIDs for bookmarkable URLs
- Data migration for legacy formats
- Responsive layout improvements
- Mobile-first interactions

## Contributing

This repository uses the MIT license. Contributions should maintain the existing code style and architecture patterns.

### PR Requirements

**IMPORTANT: All pull requests MUST update this CLAUDE.md file to document any changes made.** This includes:

1. **New Features**: Add documentation for new state variables, functions, UI components, and user interactions
2. **API Changes**: Update API endpoint documentation and response structures
3. **CSS Changes**: Document new styling classes and responsive adjustments
4. **Performance Changes**: Note any new optimizations or rate limiting considerations
5. **Version Updates**: Increment the version number in the Project Summary section

PRs that modify code without corresponding CLAUDE.md updates will not be merged. This ensures the documentation stays current and useful for all contributors.

## Contact

For issues or questions, contact the repository owner Garrett Peake.
