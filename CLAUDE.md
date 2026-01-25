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
│   └── index.js          # Cloudflare Worker entry point
├── js/                   # Frontend ES modules
│   ├── main.js           # Entry point, orchestrates initialization
│   ├── state.js          # Application state and configuration
│   ├── dom.js            # Centralized DOM element references
│   ├── api.js            # API calls (load, save, share, Scryfall, auth)
│   ├── auth.js           # Authentication UI and handlers
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

**Note**: The `script.js` and `styles.css` files in the root are legacy files kept for reference. The application now uses the modular files in `/js/` and `/styles/` directories.

## Component Details

### 1. Cloudflare Worker (`src/index.js`)

The Worker serves as the backend API and static asset server.

**Key Features**:
- Handles API routes under `/api/{user}`, `/api/share`, and `/api/auth`
- Manages GET and PUT requests for user deck data
- Manages deck sharing with live references
- Provides optional authentication with JWT tokens and PBKDF2 password hashing
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

- `POST /api/auth/register`: Creates a new account linked to a UUID
  - Accepts `{username, password, uuid}` in request body
  - Validates username (3-30 alphanumeric characters or underscores)
  - Hashes password with PBKDF2 (100,000 iterations, SHA-256)
  - Stores account data and creates reverse lookup
  - Returns `{token, username}` JWT for authentication

- `POST /api/auth/login`: Authenticates user and returns JWT
  - Accepts `{username, password}` in request body
  - Verifies password with constant-time comparison
  - Returns `{token, uuid, username}` on success
  - Uses timing-safe comparison to prevent enumeration attacks

**KV Key Patterns**:
- `user:{uuid}` - User's deck list (array of `{id, text}` objects)
- `share:{uuid}` - Share reference (`{user, deckId}`) or legacy plain text
- `account:{username}` - Account data (`{uuid, passwordHash, salt, createdAt}`)
- `uuid-account:{uuid}` - Reverse lookup from UUID to username (for protection check)

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

**Auth State Variables**:
- `authToken`: JWT token from localStorage (null if not authenticated)
- `currentUsername`: Username from localStorage (null if not authenticated)
- `isAuthenticated`: Boolean derived from authToken presence

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

- `load()`: Fetches user/share data from API on startup; handles 401 for protected decklists
- `save()`: Debounced save to API (500ms delay); includes auth headers if authenticated
- `shareDeck()`: Creates share link via API, returns URL
- `getCard(cardName)`: Fetches card data from Scryfall API
- `register(username, password, uuid)`: Creates account and stores JWT
- `login(username, password)`: Authenticates and stores JWT
- `logout()`: Clears auth state and localStorage

#### Auth Module (`js/auth.js`)

- `showAuthModal(mode)`: Opens auth modal in 'login' or 'register' mode
- `hideAuthModal()`: Closes auth modal and clears form
- `setAuthMode(mode)`: Toggles between login and register views
- `toggleAuthMode()`: Switches between login/register in modal
- `showAuthError(message)`: Displays error message in modal
- `clearAuthError()`: Clears error message
- `handleAuthSubmit(e)`: Handles form submission for login/register
- `handleLogout()`: Logs out user and redirects to landing
- `updateAuthUI()`: Updates header buttons based on auth state
- `initAuth()`: Sets up all auth event listeners

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
| `auth.css` | Auth modal and header buttons |
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

**Auth Modal & Buttons** (`styles/auth.css`):
- `.auth-modal`: Full-screen overlay with centered modal content
- `.auth-modal-content`: Dark modal with form inputs
- `.auth-input`: Styled form inputs with focus states
- `.auth-submit-btn`: Orange primary action button
- `.auth-error`: Red error message display
- `.auth-toggle`: Link to switch between login/register modes
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

**Configuration Structure**:
```toml
name = "decklister"
main = "src/index.js"
compatibility_date = "2025-01-10"
account_id = "5af9bf2be24dfe756af55b3bbd542e57"

[assets]
directory = "."
binding = "ASSETS"

[[kv_namespaces]]
binding = "DECKLISTEDITOR"
id = "bb576df04a11477f935a3b59ae24ba18"
```

**Key Configuration Elements**:
- **Assets**: Serves static files from root directory via `ASSETS` binding
- **KV Namespace**: `DECKLISTEDITOR` binding for user data persistence
- **Compatibility Date**: Uses 2025-01-10 runtime features

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

```bash
npm run deploy
```

This runs `wrangler deploy` to publish the Worker to Cloudflare's edge network.

### Local Development

While not explicitly configured in package.json, you can use:

```bash
wrangler dev
```

This starts a local development server with hot reloading.

### Environment Setup

1. Install Wrangler CLI
2. Configure Cloudflare account credentials
3. Create KV namespace matching `wrangler.toml` ID
4. Set JWT secret for production: `wrangler secret put JWT_SECRET`
5. Deploy using `npm run deploy`

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

- **Optional Authentication**: Users can create accounts to protect their decklists
- **Password Security**: PBKDF2 with 100,000 iterations and SHA-256 for password hashing
- **JWT Tokens**: HS256-signed tokens with 7-day expiry, stored in localStorage
- **Timing Attack Prevention**: Constant-time password comparison; dummy hash for non-existent users
- **Unprotected Decklists**: Without an account, data accessible to anyone with the URL
- Share links do not expose user identity (remain public even for protected decklists)
- No input sanitization on deck names
- CORS not configured (relies on same-origin)
- **JWT Secret**: Should be configured via `wrangler secret put JWT_SECRET` in production

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

**Creating an Account (Protecting Your Decklist)**:
1. Visit your decklist page (`/{uuid}`)
2. Click "Create Account" in the header
3. Enter username (3-30 alphanumeric/underscore) and password
4. Account is linked to your current UUID
5. Future visits to your UUID will require login
6. Bookmark warning is hidden once authenticated

**Logging In**:
1. Visit `/` or click "Login" button
2. Enter username and password
3. On success, redirected to your protected decklist
4. JWT token stored in localStorage (7-day expiry)

**Protected Decklist Access**:
1. Visit a protected UUID without being logged in
2. Redirected to `/?redirect={uuid}`
3. See "This decklist is protected. Please login to access it."
4. Click "Login" and authenticate
5. Automatically redirected to the protected decklist

**Logging Out**:
1. Click "Logout" button in header
2. JWT token cleared from localStorage
3. Redirected to landing page

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
- **Token expired**: Log out and log back in (tokens expire after 7 days)
- **"This decklist is protected" message**: You need to log in to access this decklist

## Repository History

Recent commits show:
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
