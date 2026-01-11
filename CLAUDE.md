# Decklist Editor - Comprehensive Repository Overview

## Project Summary

Decklist Editor is a web-based application for creating, managing, and organizing Magic: The Gathering deck lists. Built as a Cloudflare Worker application, it provides a seamless interface for users to create multiple decks, view card information from Scryfall, and automatically save their work using Cloudflare KV storage.

**Author**: Garrett Peake
**License**: MIT
**Version**: 1.1.0

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
├── index.html            # Main application UI
├── script.js             # Frontend application logic
├── styles.css            # Application styling
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Node.js project configuration
└── .gitignore           # Git ignore rules
```

## Component Details

### 1. Cloudflare Worker (`src/index.js`)

The Worker serves as the backend API and static asset server.

**Key Features**:
- Handles API routes under `/api/{user}` and `/api/share`
- Manages GET and PUT requests for user deck data
- Manages deck sharing with live references
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

**KV Key Patterns**:
- `user:{username}` - User's deck list (array of `{id, text}` objects)
- `share:{uuid}` - Share reference (`{user, deckId}`) or legacy plain text

**Data Migration** (src/index.js:82-116):
- Checks for new `user:` prefixed key first
- Falls back to legacy unprefixed key
- Detects old format (string array) vs new format (object array)
- Auto-assigns UUIDs to migrated decks
- Saves migrated data with new prefix

### 2. Frontend Application (`script.js`)

The frontend manages deck editing, card lookups, URL routing, and UI interactions.

**Core State Variables**:
- `data`: Array of deck objects `{id: string, text: string}` (plain strings in share mode)
- `link_cache`: Object caching Scryfall card lookups
- `selectedDeck`: Index of currently active deck
- `isMobile`: Boolean tracking viewport width (≤768px)
- `isRenderMode`: Boolean for mobile render/edit mode toggle
- `isShareMode`: Boolean for read-only share view
- `shareId`: UUID from share URL path
- `currentUser`: Username parsed from URL
- `initialDeckId`: Deck ID parsed from URL for deep linking

**Key Functions**:

- `load()` (script.js:58-84): Fetches user/share data from API on startup
- `save()` (script.js:86-99): Debounced save to API (500ms delay)
- `getDeckText(index)` (script.js:46-51): Helper to get deck text (handles both modes)
- `getDeckId(index)` (script.js:54-56): Helper to get deck UUID
- `updateUrl(deckId)` (script.js:101-109): Updates browser URL via history.pushState
- `shareDeck()` (script.js:136-158): Creates share link via API
- `copyShareUrl()` (script.js:160-167): Copies share URL to clipboard
- `setDeckList()` (script.js:169-265): Renders deck selection with share button
- `display_card()` (script.js:267-302): Shows card images with mobile tap-to-open support
- `updateData()` (script.js:304-392): Parses deck text and displays card links
- `get_card()` (script.js:394-406): Fetches card data from Scryfall API
- `switchDeck()` (script.js:416-432): Changes active deck and updates URL
- `updateRenderToggleIcon()` (script.js:458-470): Updates mobile toggle button icon

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

### 3. User Interface (`index.html`)

**Desktop Layout** (4-column):
1. **Collapsible Sidebar** (`.sidebar`): Deck list with add/share/delete buttons, toggle button to collapse
2. **Text Editor** (`.editor-textarea`): Deck text input area
3. **Card Links** (`.card-links`): Rendered card list with Scryfall links
4. **Card Display** (`.card-display`): Card image preview area

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
- Top 25% shows card art display
- Bottom 75% shows rendered card list
- Tap card name to show its art
- Tap card art to open Scryfall

**Editor Features** (index.html:38-39):
- Spellcheck disabled for card names
- Placeholder instructions for new users
- Auto-expanding textarea based on content

**Asset Paths**:
- CSS and JS use absolute paths (`/styles.css`, `/script.js`)
- Required for nested routes like `/share/{uuid}` and `/{user}/{deckId}`

### 4. Styling (`styles.css`)

**CSS Custom Properties** (styles.css:4-24):
- `--bg-primary`: Main background (#1e1e24)
- `--bg-secondary`: Sidebar/panels (#2a2a32)
- `--bg-tertiary`: Elevated elements (#33333b)
- `--accent-primary`: Purple accent (#7c5cbf)
- `--accent-hover`: Hover state (#9370db)
- `--danger`: Delete/error states (#c45c5c)
- `--transition-fast/normal`: Animation timing
- `--radius-sm/md/lg/full`: Border radius values
- `--shadow-sm/md/lg`: Box shadow values

**Design Characteristics**:
- Modern dark theme with CSS variables
- Flexbox-based responsive layout
- Smooth transitions and subtle shadows
- Custom WebKit scrollbar styling
- Gradient background on card display area
- System font stack for better performance

**Share Button Styling** (styles.css:591-609):
- Purple accent outline style
- Matches theme with hover states

**Share Modal Styling** (styles.css:611-706):
- Dark overlay background
- Centered modal with shadow
- Monospace font for URL input
- Copy button with accent color

**Share Mode Styling** (styles.css:708-765):
- Hides sidebar, header, editor
- Full-width card links panel
- Mobile-responsive adjustments

**Responsive Breakpoints**:
- **Mobile** (≤768px): Single column, header with dropdown, floating render toggle
- **Tablet** (769-1024px): Narrower sidebar (180px), adjusted proportions
- **Desktop** (>1024px): Full 4-column layout with collapsible sidebar (220px)
- **Large Desktop** (≥1400px): Wider sidebar (260px), increased padding

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
4. Deploy using `npm run deploy`

## Technical Notes

### Performance Optimizations

- **Debounced Saves**: 500ms delay prevents excessive API calls
- **Debounced Parsing**: 500ms delay for card link updates
- **Link Caching**: LocalStorage prevents redundant Scryfall API calls
- **Edge Computing**: Cloudflare Workers provide global low-latency access

### Browser Compatibility

- Modern browsers with ES6+ support required
- Uses Fetch API (no polyfills included)
- Uses `crypto.randomUUID()` for deck IDs
- Uses History API for URL management
- Flexbox-based responsive layout
- Custom scrollbar styling (WebKit only)
- Mobile-responsive with touch interactions
- Tested breakpoints: 768px (mobile), 1024px (tablet), 1400px (large desktop)

### Security Considerations

- No authentication implemented (user URLs are public)
- Data accessible to anyone with the URL path
- Share links do not expose user identity
- No input sanitization on deck names
- CORS not configured (relies on same-origin)

### Data Migration

The system automatically handles legacy data:
- Old KV keys without `user:` prefix are migrated
- Old deck format (string arrays) migrated to object arrays with UUIDs
- Old share format (plain text) still supported for reading
- Migration is non-destructive (original data preserved during transition)

## API Dependencies

### Scryfall API

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

- User authentication and private decks
- Export to various formats (MTGO, Arena, text)
- Import from popular deck sites
- Deck statistics (mana curve, color distribution)
- Card price integration
- Drag-and-drop deck reordering
- Deck categorization and search
- Collaborative deck editing

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

## Repository History

Recent commits show:
- Deck sharing feature with live references
- Deck UUIDs for bookmarkable URLs
- Data migration for legacy formats
- Responsive layout improvements
- Mobile-first interactions

## Contributing

This repository uses the MIT license. Contributions should maintain the existing code style and architecture patterns.

## Contact

For issues or questions, contact the repository owner Garrett Peake.
