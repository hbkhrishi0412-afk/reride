# ReRide Design System

Complete design system documentation for the ReRide Vehicle Marketplace Platform.

## Table of Contents

- [Colors](#colors)
- [Typography](#typography)
- [Spacing](#spacing)
- [Components](#components)
- [Icons](#icons)
- [Animations](#animations)
- [Layout](#layout)
- [Responsive Design](#responsive-design)
- [Accessibility](#accessibility)

---

## Colors

### Primary Colors

```css
--reride-orange: #FF6B35;        /* Primary brand color */
--reride-orange-light: #FF8C5A;  /* Light variant */
--reride-orange-dark: #E55A2B;   /* Dark variant */
```

**Usage:**
- Primary buttons
- Links
- Accent elements
- Call-to-action buttons
- Focus indicators

### Secondary Colors

```css
--reride-blue: #0084FF;          /* Secondary actions */
--reride-green: #10B981;         /* Success states */
--reride-red: #EF4444;           /* Error states */
--reride-yellow: #F59E0B;        /* Warning states */
```

### Neutral Colors

```css
--reride-text-dark: #1A1A1A;     /* Primary text */
--reride-text: #2C2C2C;          /* Secondary text */
--reride-text-light: #666666;    /* Tertiary text */
--reride-gray: #E5E7EB;          /* Borders, dividers */
--reride-off-white: #F9FAFB;     /* Backgrounds */
--reride-white: #FFFFFF;          /* Pure white */
```

### Semantic Colors

```css
/* Success */
.success-bg: #D1FAE5;
.success-text: #065F46;

/* Error */
.error-bg: #FEE2E2;
.error-text: #991B1B;

/* Warning */
.warning-bg: #FEF3C7;
.warning-text: #92400E;

/* Info */
.info-bg: #DBEAFE;
.info-text: #1E40AF;
```

### Color Usage Guidelines

- **Primary Orange**: Use for primary actions, brand elements, and highlights
- **Blue**: Use for secondary actions and links
- **Green**: Use for success messages and positive states
- **Red**: Use for errors, destructive actions, and alerts
- **Yellow**: Use for warnings and important notices
- **Neutral Grays**: Use for text, borders, and backgrounds

---

## Typography

### Font Families

```css
/* Primary Font - Poppins */
font-family: 'Poppins', sans-serif;

/* Secondary Font - Nunito Sans */
font-family: 'Nunito Sans', sans-serif;
```

**Font Loading:**
- Preloaded with `display=swap` for performance
- Subsetted for optimal file size

### Font Sizes

```css
/* Headings */
.text-4xl { font-size: 2.25rem; }    /* 36px - Hero Headings */
.text-3xl { font-size: 1.875rem; }   /* 30px - Page Titles */
.text-2xl { font-size: 1.5rem; }     /* 24px - Section Headings */
.text-xl { font-size: 1.25rem; }     /* 20px - Subsection Headings */
.text-lg { font-size: 1.125rem; }    /* 18px - Large Text */

/* Body */
.text-base { font-size: 1rem; }      /* 16px - Body Text */
.text-sm { font-size: 0.875rem; }    /* 14px - Small Text */
.text-xs { font-size: 0.75rem; }     /* 12px - Captions */
```

### Font Weights

```css
font-weight: 400;  /* Regular */
font-weight: 500;  /* Medium */
font-weight: 600;  /* Semi-bold */
font-weight: 700;  /* Bold */
font-weight: 800;  /* Extra-bold */
```

### Typography Scale

| Element | Font Size | Weight | Line Height | Usage |
|---------|-----------|--------|-------------|-------|
| H1 | 2.25rem (36px) | 800 | 1.2 | Page titles |
| H2 | 1.875rem (30px) | 700 | 1.3 | Section headings |
| H3 | 1.5rem (24px) | 600 | 1.4 | Subsection headings |
| H4 | 1.25rem (20px) | 600 | 1.5 | Card titles |
| Body | 1rem (16px) | 400 | 1.6 | Body text |
| Small | 0.875rem (14px) | 400 | 1.5 | Secondary text |
| Caption | 0.75rem (12px) | 400 | 1.4 | Labels, captions |

### Text Styles

```css
/* Heading Styles */
.heading-primary {
  font-family: 'Poppins', sans-serif;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--reride-text-dark);
  line-height: 1.2;
}

.heading-secondary {
  font-family: 'Poppins', sans-serif;
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--reride-text-dark);
  line-height: 1.3;
}

/* Body Styles */
.body-text {
  font-family: 'Poppins', sans-serif;
  font-size: 1rem;
  font-weight: 400;
  color: var(--reride-text);
  line-height: 1.6;
}

.body-text-light {
  font-family: 'Poppins', sans-serif;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--reride-text-light);
  line-height: 1.5;
}
```

---

## Spacing

### Spacing Scale

Based on 4px base unit:

```css
0    = 0px
1    = 0.25rem (4px)
2    = 0.5rem (8px)
3    = 0.75rem (12px)
4    = 1rem (16px)
5    = 1.25rem (20px)
6    = 1.5rem (24px)
8    = 2rem (32px)
10   = 2.5rem (40px)
12   = 3rem (48px)
16   = 4rem (64px)
20   = 5rem (80px)
24   = 6rem (96px)
```

### Spacing Usage

- **Padding**: Use for internal spacing within components
- **Margin**: Use for external spacing between components
- **Gap**: Use in flexbox/grid layouts

### Common Spacing Patterns

```css
/* Component Padding */
.padding-sm { padding: 0.75rem; }    /* 12px */
.padding-md { padding: 1rem; }        /* 16px */
.padding-lg { padding: 1.5rem; }      /* 24px */
.padding-xl { padding: 2rem; }        /* 32px */

/* Section Spacing */
.section-spacing { margin-bottom: 4rem; }  /* 64px */
```

---

## Components

### Buttons

#### Primary Button

```tsx
<button className="bg-[#FF6B35] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E55A2B] transition-colors">
  Primary Action
</button>
```

**States:**
- Default: Orange background, white text
- Hover: Darker orange background
- Active: Pressed state
- Disabled: Gray background, reduced opacity

#### Secondary Button

```tsx
<button className="bg-white text-[#FF6B35] border-2 border-[#FF6B35] px-6 py-3 rounded-lg font-semibold hover:bg-[#FF6B35] hover:text-white transition-colors">
  Secondary Action
</button>
```

#### Button Sizes

```css
/* Small */
.btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }

/* Medium (Default) */
.btn-md { padding: 0.75rem 1.5rem; font-size: 1rem; }

/* Large */
.btn-lg { padding: 1rem 2rem; font-size: 1.125rem; }
```

### Forms

#### Input Fields

```tsx
<input 
  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
  type="text"
  placeholder="Enter text"
/>
```

**States:**
- Default: Gray border
- Focus: Orange ring, transparent border
- Error: Red border, error message
- Disabled: Gray background, reduced opacity

#### Labels

```tsx
<label className="block text-sm font-semibold text-gray-700 mb-2">
  Label Text
</label>
```

### Cards

#### Vehicle Card

```tsx
<div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
  <img src="..." className="w-full h-48 object-cover" />
  <div className="p-4">
    <h3 className="text-lg font-bold text-gray-900">Vehicle Title</h3>
    <p className="text-[#FF6B35] text-xl font-bold mt-2">₹6,50,000</p>
  </div>
</div>
```

**Card Variants:**
- Default: White background, shadow
- Hover: Increased shadow
- Featured: Orange border accent

### Navigation

#### Header

- Height: 64px (mobile), 80px (desktop)
- Background: White with shadow
- Sticky positioning

#### Navigation Links

```css
.nav-link {
  color: var(--reride-text);
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
}

.nav-link:hover {
  background-color: var(--reride-off-white);
  color: var(--reride-orange);
}
```

---

## Icons

### Icon Library

- **Material Icons** (primary)
- **Heroicons** (secondary)
- **Custom SVG icons** (brand-specific)

### Icon Sizes

```css
.icon-sm { width: 16px; height: 16px; }
.icon-md { width: 24px; height: 24px; }
.icon-lg { width: 32px; height: 32px; }
.icon-xl { width: 48px; height: 48px; }
```

### Icon Usage

- Use consistent icon sizes within components
- Maintain 4px spacing around icons
- Use semantic colors for icons
- Provide alt text for accessibility

---

## Animations

### Transition Durations

```css
.transition-fast { transition-duration: 150ms; }
.transition-base { transition-duration: 200ms; }
.transition-slow { transition-duration: 300ms; }
```

### Common Animations

#### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
```

#### Slide Up

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Loading Spinner

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-spinner {
  border: 3px solid var(--reride-orange-light);
  border-top-color: var(--reride-orange);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

### Animation Guidelines

- Use subtle animations (200-300ms)
- Prefer `transform` and `opacity` for performance
- Respect `prefers-reduced-motion` media query
- Use easing functions: `ease-in-out`, `ease-out`

---

## Layout

### Container Widths

```css
.container-sm { max-width: 640px; }
.container-md { max-width: 768px; }
.container-lg { max-width: 1024px; }
.container-xl { max-width: 1280px; }
.container-full { max-width: 100%; }
```

### Grid System

```css
/* 12-column grid */
.grid-12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 1.5rem;
}
```

### Common Layouts

#### Page Layout

```tsx
<div className="min-h-screen bg-gray-50">
  <Header />
  <main className="container mx-auto px-4 py-8">
    {content}
  </main>
  <Footer />
</div>
```

#### Card Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {cards}
</div>
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile First Approach */
sm: 640px   /* Small devices (tablets) */
md: 768px   /* Medium devices (small laptops) */
lg: 1024px  /* Large devices (desktops) */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X Extra large devices */
```

### Mobile-First Guidelines

1. **Design for mobile first**
2. **Progressive enhancement** for larger screens
3. **Touch targets**: Minimum 44x44px
4. **Readable text**: Minimum 16px font size
5. **Adequate spacing**: Minimum 8px between interactive elements

### Responsive Patterns

```tsx
// Responsive Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items}
</div>

// Responsive Text
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Responsive Heading
</h1>

// Responsive Spacing
<div className="p-4 md:p-6 lg:p-8">
  Content
</div>
```

---

## Accessibility

### Color Contrast

- **Text on background**: Minimum 4.5:1 ratio (WCAG AA)
- **Large text**: Minimum 3:1 ratio
- **Interactive elements**: Minimum 3:1 ratio

### Focus Indicators

```css
*:focus-visible {
  outline: 2px solid var(--reride-orange);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
}
```

### Screen Reader Support

```tsx
// Semantic HTML
<button aria-label="Close dialog">
  <Icon name="close" />
</button>

// Skip links
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### Accessibility Checklist

- [ ] All images have alt text
- [ ] Forms have labels
- [ ] Interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] ARIA labels where needed
- [ ] Semantic HTML used
- [ ] Skip links provided

---

## Design Tokens

### CSS Variables

All design tokens are available as CSS variables:

```css
:root {
  /* Colors */
  --reride-orange: #FF6B35;
  --reride-text-dark: #1A1A1A;
  
  /* Spacing */
  --spacing-unit: 4px;
  
  /* Typography */
  --font-primary: 'Poppins', sans-serif;
  --font-secondary: 'Nunito Sans', sans-serif;
}
```

### Usage in Components

```tsx
<div style={{ 
  color: 'var(--reride-orange)',
  padding: 'var(--spacing-md)'
}}>
  Content
</div>
```

---

## Best Practices

### Do's

✅ Use design system colors and spacing
✅ Maintain consistency across components
✅ Follow responsive design patterns
✅ Ensure accessibility compliance
✅ Use semantic HTML
✅ Test on multiple devices

### Don'ts

❌ Don't use arbitrary colors
❌ Don't create custom spacing values
❌ Don't skip accessibility features
❌ Don't use inline styles (prefer classes)
❌ Don't ignore responsive breakpoints

---

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design](https://material.io/design)
- [Framer Motion](https://www.framer.com/motion/)

---

*Last Updated: 2024*
*Design System Version: 1.0*


