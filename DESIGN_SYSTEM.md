# Tale of Asia — Design System

## Vision
A dark fantasy MMORPG website with a moody, minimal aesthetic. Deep blacks, muted gold, ember red — no specific cultural markers. The design feels like entering a dark game world: stripped-down, cinematic, and atmospheric.

## Design Philosophy
- **Dark Fantasy MMORPG**: Moody, atmospheric, minimal cultural markers
- **Cinematic**: Full-screen sections, alternating layouts, horizontal scroll
- **Stripped-Down**: No decorative characters, no busy grids — clean and bold
- **Game-Like**: Every element should feel like entering a dark game world

## Color Palette

### Primary Colors
- **Obsidian Black**: `#0A0A0F` - Void black backdrop
- **Charcoal**: `#14111A` - Dark ash-purple
- **Deep Crimson**: `#8B0000` - Blood red / danger
- **Royal Gold**: `#C9A84C` - Aged gold, muted
- **Ancient Bronze**: `#7A6840` - Faded bronze

### Accent Colors
- **Mystical Blue**: `#3B5998` - Deep arcane blue
- **Dark Steel**: `#2A2530` - Dark steel-purple
- **Glowing Cyan**: `#4FC3F7` - Soulfire cyan
- **Crimson Glow**: `#B71C1C` - Ember red glow

### Semantic Colors
- **Success**: `#2E7D32` (forest green)
- **Warning**: `#E65100` (ember orange)
- **Danger**: `#D32F2F` (blood red)
- **Info**: `#3B5998` (arcane blue)

## Typography

### Headings
- **Font**: "Cinzel" (Google Fonts) — bold serif, fantasy feel
- **Weights**: 400, 500, 600, 700, 800, 900
- **Usage**: Page titles, section headers, hero text
- **Characteristics**: Bold, commanding, minimal

### Body Text
- **Font**: "Inter" (Google Fonts) — clean sans-serif
- **Weights**: 300, 400, 500, 600, 700
- **Usage**: Paragraphs, descriptions, UI text
- **Characteristics**: Readable, clean, modern

### UI Text
- **Font**: "JetBrains Mono" (monospace)
- **Weights**: 400, 600
- **Usage**: Stats, numbers, technical info
- **Characteristics**: Precise, technical, game-like

## UI Components

### Dark Fantasy Card (`.metallic-card`)
- **Background**: Dark ash-purple gradient (`#1A1520` → `#0A0A0F`)
- **Border**: Muted gold, subtle
- **Shadow**: Deep black with faint gold inner highlight
- **Hover**: Border brightens, lifts up 2px
- **Rarity Tiers**:
  - Common: Gray border
  - Uncommon: Green border
  - Rare: Blue border
  - Epic: Purple border
  - Legendary: Gold border

### Buttons
- **Primary (`.glow-button`)**: Ember red gradient with aged gold text
- **Secondary (`.crimson-button`)**: Dark steel with gold border/text
- **Hover**: Increased glow, slight scale, color shift
- **Active**: Pressed down effect
- **Disabled**: Dimmed, no glow

### Navigation
- **Style**: Horizontal bar with ember red accent border
- **Background**: Dark charcoal with backdrop blur
- **Text**: Gold/slate with crimson hover
- **Logo**: Tale of Asia logo, compact

### Badges/Labels
- **PvP**: Crimson glow
- **Legendary**: Gold glow
- **Online**: Green glow
- **Offline**: Gray
- **Maintenance**: Orange glow

## Visual Effects

### Glows
- **Soft Glow**: `box-shadow: 0 0 20px rgba(201, 168, 76, 0.18)`
- **Intense Glow**: `box-shadow: 0 0 30px rgba(201, 168, 76, 0.35)`
- **Crimson Glow**: `box-shadow: 0 0 20px rgba(183, 28, 28, 0.22)`
- **Cyan Glow**: `box-shadow: 0 0 20px rgba(79, 195, 247, 0.18)`

### Borders
- **Gold Border**: Solid with soft glow
- **Crimson Border**: Solid with intense glow
- **Animated Border**: Slow animation for active elements

### Animations
- **Fade In**: 600ms ease-out with upward motion
- **Embers Glow**: 3s infinite pulsing gold/ember glow
- **Logo Pulse**: 4s scale + glow pulse (embers effect)
- **Float**: 4s gentle floating motion
- **Shimmer**: 3s linear gold text shimmer
- **Hover Scale**: 1.05x on hover

## Layout Patterns

### Hero Section
- **Background**: Void black with radial ember/gold gradients
- **Layout**: Full-screen, centered, minimal
- **Content**: Logo, title, subtitle, 2 CTAs, live server status
- **No split layout** — single column, cinematic

### Stat Strip
- **Layout**: Horizontal 4-column strip with divider lines
- **Content**: Years running, active warriors, classes, free to play
- **No cards** — flat, info-dense

### War Room
- **Layout**: Compact horizontal cards with thumbnail + clan info
- **Crown Holders**: Bless Castle + Bellatra side by side
- **No large banner images** — compact and info-dense

### Feature Showcase
- **Layout**: Alternating left/right full-width rows
- **Content**: Numbered (01/04), title, description, visual placeholder
- **No grid** — vertical scrolling narrative

### Class Arsenal
- **Layout**: Horizontal scrollable strip with snap
- **Cards**: Compact, fixed width, scrollable
- **No grid** — horizontal scroll experience

### Final Call
- **Layout**: Minimal centered text, 2 CTAs (register + download)
- **Social links**: Plain text links, no buttons
- **No card wrapper** — open and dark

### Rankings
- **Layout**: Table or card-based
- **Highlights**: Top 3 with special styling
- **Medals**: 🥇🥈🥉 with glow

## Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Mobile Adjustments
- **Navigation**: Compact mobile menu
- **Cards**: Full width with padding
- **Typography**: Scaled down appropriately
- **Animations**: Reduced for performance

## Accessibility

- **Contrast**: WCAG AA minimum (4.5:1 for text)
- **Focus States**: Visible keyboard navigation
- **Alt Text**: All images have descriptive alt text
- **Semantic HTML**: Proper heading hierarchy
- **Color**: Not the only indicator (use icons/text)

## Performance

- **Animations**: GPU-accelerated transforms
- **Images**: Optimized and lazy-loaded
- **Fonts**: System fonts + 2-3 web fonts max
- **Particles**: Minimal, performance-aware
- **Load Time**: < 3s on 4G

## Component Library

### Reusable Components
1. **GlowCard**: Card with glow effects
2. **GlowButton**: Button with glow on hover
3. **ClanBadge**: Clan icon with status
4. **RarityBadge**: Item/content rarity indicator
5. **WarBanner**: Event/battle banner
6. **StatBlock**: Stats display with icons
7. **HeroSection**: Cinematic hero banner
8. **FeatureRow**: Alternating feature showcase row
9. **ClassScroll**: Horizontal scrollable class strip
10. **AnimatedBorder**: Animated border effect

## Theme Files
- `app/theme/asian-imperial-theme.css` — Main theme (colors, components, animations)
- `app/globals.css` — Base styles, Tailwind imports, font variables

## Implementation Notes

- Use Tailwind CSS with custom theme configuration
- Create CSS variables for colors and effects
- Use CSS animations for performance
- Implement lazy loading for images
- Use Next.js Image component for optimization
- Consider using Framer Motion for complex animations
- Test on actual devices for performance
- Use CSS Grid/Flexbox for layouts
- Implement dark mode as default
- Ensure mobile-first responsive design
