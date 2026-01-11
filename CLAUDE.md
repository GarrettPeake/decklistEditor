# Decklist Editor - Comprehensive Repository Overview

## Project Summary

Decklist Editor is a web-based application for creating, managing, and organizing Magic: The Gathering deck lists. Built as a Cloudflare Worker application, it provides a seamless interface for users to create multiple decks, view card information from Scryfall, and automatically save their work using Cloudflare KV storage.

**Author**: Garrett Peake
**License**: MIT
**Version**: 1.0.0

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
- Handles API routes under `/api/{user}`
- Manages GET and PUT requests for user deck data
- Integrates with Cloudflare KV for persistent storage
- Serves static assets (HTML, CSS, JS) for all other routes

**API Endpoints**:

- `GET /api/{user}`: Retrieves user's deck data from KV storage
  - Returns empty array `[]` if no data exists
  - Automatically initializes storage for new users

- `PUT /api/{user}`: Saves user's deck data to KV storage
  - Accepts JSON-stringified deck array in request body
  - Returns saved data on success

**Code Flow** (src/index.js:1-42):
1. Parse incoming request URL
2. Route API requests to KV storage handlers
3. Fallback to static asset serving via `ASSETS` binding

### 2. Frontend Application (`script.js`)

The frontend manages deck editing, card lookups, and UI interactions.

**Core State Variables**:
- `data`: Array of deck strings (one per deck)
- `link_cache`: Object caching Scryfall card lookups
- `selectedDeck`: Index of currently active deck
- `isMobile`: Boolean tracking viewport width (≤768px)
- `isRenderMode`: Boolean for mobile render/edit mode toggle

**Key Functions**:

- `load()` (script.js:32-38): Fetches user data from API on startup
- `save()` (script.js:40-50): Debounced save to API (500ms delay)
- `setDeckList()` (script.js:52-123): Renders deck selection in both desktop sidebar and mobile dropdown
- `updateData()` (script.js:162-243): Parses deck text and displays card links with platform-specific interactions
- `get_card()` (script.js:245-257): Fetches card data from Scryfall API
- `display_card()` (script.js:125-160): Shows card images with mobile tap-to-open support
- `switchDeck()` (script.js:267-277): Changes active deck
- `updateRenderToggleIcon()` (script.js:304-315): Updates mobile toggle button icon

**User Interactions**:
- Text editing triggers automatic deck parsing and save
- Card names are auto-linked to Scryfall pages
- **Desktop**: Hover over card names to display images, click to open Scryfall
- **Mobile**: Tap card names to display images, tap images to open Scryfall

### 3. User Interface (`index.html`)

**Desktop Layout** (4-column):
1. **Collapsible Sidebar** (`.sidebar`): Deck list with add/delete buttons, toggle button to collapse
2. **Text Editor** (`.editor-textarea`): Deck text input area
3. **Card Links** (`.card-links`): Rendered card list with Scryfall links
4. **Card Display** (`.card-display`): Card image preview area

**Mobile Layout** (≤768px):
1. **Header Bar** (`.mobile-header`): Title and hamburger menu button
2. **Dropdown Menu** (`.mobile-dropdown`): Deck selection dropdown from header
3. **Content Area**: Either editor (default) or rendered view
4. **Render Toggle** (`.render-toggle`): Floating button to switch between edit/render modes

**Mobile Render Mode**:
- Top 25% shows card art display
- Bottom 75% shows rendered card list
- Tap card name to show its art
- Tap card art to open Scryfall

**Editor Features** (index.html:38-39):
- Spellcheck disabled for card names
- Placeholder instructions for new users
- Auto-expanding textarea based on content

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

1. User navigates to `/{username}` (e.g., `/garrett`)
2. `script.js` starts, calls `load()`
3. Frontend fetches `/api/{username}`
4. Worker retrieves data from KV or initializes with `[]`
5. Frontend populates deck list and editor
6. Link cache loaded from localStorage

### Saving Process

1. User edits deck text in textarea
2. `oninput` event triggers (script.js:165)
3. 500ms debounced `save()` queues API PUT request
4. Data sent to `/api/{username}`
5. Worker stores JSON in KV namespace
6. Link cache saved to localStorage

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
- Switch between decks with sidebar buttons
- Delete decks with confirmation prompt
- Auto-save every 500ms after editing

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
- Flexbox-based responsive layout
- Custom scrollbar styling (WebKit only)
- Mobile-responsive with touch interactions
- Tested breakpoints: 768px (mobile), 1024px (tablet), 1400px (large desktop)

### Security Considerations

- No authentication implemented (user URLs are public)
- Data accessible to anyone with the URL path
- No input sanitization on deck names
- CORS not configured (relies on same-origin)

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
9. Switch decks using sidebar buttons
10. Delete unwanted decks with confirmation

### Mobile Workflow
1. Navigate to `https://yourworker.workers.dev/{username}`
2. Tap hamburger menu (top right) to open deck dropdown
3. Select a deck or tap "+ Add Deck"
4. Edit deck text in the editor (default view)
5. Tap floating grid button (bottom right) to switch to render mode
6. In render mode: tap card names to show art, tap art to open Scryfall
7. Tap pencil button to return to edit mode

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

## Future Enhancement Opportunities

- User authentication and private decks
- Export to various formats (MTGO, Arena, text)
- Import from popular deck sites
- Deck statistics (mana curve, color distribution)
- Card price integration
- Drag-and-drop deck reordering
- Deck categorization and search
- Share/collaboration features

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

## Repository History

Recent commits show conversion from Cloudflare Pages format to Workers format, including:
- Migration from Pages Functions to Workers API routes
- Configuration updates in wrangler.toml
- Asset serving via Workers binding

## Contributing

This repository uses the MIT license. Contributions should maintain the existing code style and architecture patterns.

## Contact

For issues or questions, contact the repository owner Garrett Peake.
