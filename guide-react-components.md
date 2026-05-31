# React Component Library Guide

This guide covers building the component library that powers the Considerate Systems site and serves as the reusable agency template. Components are written once here; Payload Blocks wire them to the editor; if Builder.io is ever added, the same components register there with minimal changes.

---

## 1. Folder Structure

```
app/src/
  components/
    ui/               # Dumb, stateless primitives — no data fetching
      Button.tsx
      Badge.tsx
      Card.tsx
    blocks/           # Block-level components — match the Payload block slugs
      Hero.tsx
      ProjectsGrid.tsx
      RichTextBlock.tsx
      CTABlock.tsx
    layout/           # Wrappers that appear on every page
      Nav.tsx
      Footer.tsx
      PageLayout.tsx
    sections/         # Standalone page sections not used as blocks
      ProjectCard.tsx
```

Keep `ui/` components purely presentational. They receive props and render HTML — no `fetch`, no Payload imports. `blocks/` components may fetch from Payload when the block configuration calls for it (e.g., ProjectsGrid fetches the projects collection).

---

## 2. Fetching from Payload

Create a shared helper so fetch calls are consistent:

**`app/src/lib/payload.ts`**
```typescript
const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export async function getProjects(opts?: { featuredOnly?: boolean; limit?: number }) {
  const params = new URLSearchParams()
  if (opts?.featuredOnly) params.set('where[featured][equals]', 'true')
  if (opts?.limit)        params.set('limit', String(opts.limit))

  const res = await fetch(`${API_URL}/api/projects?${params}`, {
    next: { revalidate: 60 },  // ISR: re-fetch at most every 60s
  })
  if (!res.ok) return []
  const { docs } = await res.json()
  return docs
}

export async function getPage(slug: string) {
  const res = await fetch(
    `${API_URL}/api/pages?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
    { next: { revalidate: 60 } }
  )
  if (!res.ok) return null
  const { docs } = await res.json()
  return docs[0] ?? null
}

export async function getSiteSettings() {
  const res = await fetch(`${API_URL}/api/globals/site-settings`, {
    next: { revalidate: 3600 },  // nav/footer rarely change
  })
  if (!res.ok) return null
  return res.json()
}
```

---

## 3. UI Primitives

**`app/src/components/ui/Button.tsx`**
```tsx
interface ButtonProps {
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

export function Button({ href, onClick, variant = 'primary', size = 'md', children, className = '' }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    outline: 'border border-current text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
    ghost:   'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-400',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3.5 text-lg',
  }

  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`

  if (href) return <a href={href} className={cls}>{children}</a>
  return <button onClick={onClick} className={cls}>{children}</button>
}
```

**`app/src/components/ui/Badge.tsx`**
```tsx
export function Badge({ label }: { label: string }) {
  return (
    <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
    </span>
  )
}
```

---

## 4. ProjectCard

Used by `ProjectsGrid` and anywhere else a project needs to be displayed.

**`app/src/components/sections/ProjectCard.tsx`**
```tsx
import { Badge } from '../ui/Badge'

interface Project {
  id: string
  title: string
  slug: string
  client?: string
  description?: string
  image?: { url: string; alt?: string }
  technologies?: { tech: string }[]
  liveUrl?: string
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="group flex flex-col rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
      {project.image && (
        <div className="aspect-video overflow-hidden">
          <img
            src={project.image.url}
            alt={project.image.alt || project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div className="flex flex-col flex-1 p-5 gap-3">
        {project.client && (
          <p className="text-xs text-gray-500 uppercase tracking-wide">{project.client}</p>
        )}
        <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
        {project.description && (
          <p className="text-gray-600 text-sm leading-relaxed flex-1">{project.description}</p>
        )}

        {project.technologies && project.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.technologies.map(({ tech }) => (
              <Badge key={tech} label={tech} />
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <a href={`/projects/${project.slug}`} className="text-sm font-medium text-blue-600 hover:underline">
            View case study →
          </a>
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer"
               className="text-sm font-medium text-gray-500 hover:text-gray-800">
              Live site ↗
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
```

---

## 5. Block Components

These match the Payload block slugs defined in `guide-payload-admin.md`. The `[...slug]/page.tsx` route renders these by switching on `block.blockType`.

**`app/src/components/blocks/Hero.tsx`**
```tsx
import { Button } from '../ui/Button'

interface HeroProps {
  heading: string
  subheading?: string
  ctaLabel?: string
  ctaHref?: string
  image?: { url: string; alt?: string }
  align?: 'left' | 'center'
}

export function Hero({ heading, subheading, ctaLabel, ctaHref, image, align = 'center' }: HeroProps) {
  const textAlign = align === 'center' ? 'text-center items-center' : 'text-left items-start'

  return (
    <section className="relative min-h-[60vh] flex items-center bg-gray-950 text-white overflow-hidden">
      {image && (
        <img
          src={image.url}
          alt={image.alt || ''}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
      )}
      <div className={`relative z-10 max-w-4xl mx-auto px-6 py-24 flex flex-col gap-6 ${textAlign}`}>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight">{heading}</h1>
        {subheading && (
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl">{subheading}</p>
        )}
        {ctaLabel && ctaHref && (
          <Button href={ctaHref} size="lg" className="mt-2 self-start">
            {ctaLabel}
          </Button>
        )}
      </div>
    </section>
  )
}
```

**`app/src/components/blocks/ProjectsGrid.tsx`**
```tsx
import { getProjects } from '../../lib/payload'
import { ProjectCard } from '../sections/ProjectCard'

interface ProjectsGridProps {
  heading?: string
  featuredOnly?: boolean
  limit?: number
  layout?: 'grid' | 'list'
}

export async function ProjectsGrid({ heading, featuredOnly = true, limit = 6, layout = 'grid' }: ProjectsGridProps) {
  const projects = await getProjects({ featuredOnly, limit })

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      {heading && (
        <h2 className="text-3xl font-bold text-gray-900 mb-10">{heading}</h2>
      )}
      <div className={
        layout === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
          : 'flex flex-col gap-6'
      }>
        {projects.map((project: any) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
```

Note: `ProjectsGrid` is an `async` Server Component — it fetches on the server, no client-side JS needed.

**`app/src/components/blocks/CTABlock.tsx`**
```tsx
import { Button } from '../ui/Button'

interface CTAProps {
  heading: string
  body?: string
  buttonLabel?: string
  buttonHref?: string
  style?: 'light' | 'dark'
}

export function CTABlock({ heading, body, buttonLabel, buttonHref, style = 'dark' }: CTAProps) {
  const bg   = style === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-900'
  const btn  = style === 'dark' ? 'outline' : 'primary'

  return (
    <section className={`${bg} py-20 px-6`}>
      <div className="max-w-3xl mx-auto text-center flex flex-col gap-6">
        <h2 className="text-3xl md:text-4xl font-bold">{heading}</h2>
        {body && <p className="text-lg opacity-80">{body}</p>}
        {buttonLabel && buttonHref && (
          <div>
            <Button href={buttonHref} variant={btn as any} size="lg">
              {buttonLabel}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
```

---

## 6. Layout Components

**`app/src/components/layout/Nav.tsx`**
```tsx
import { getSiteSettings } from '../../lib/payload'

export async function Nav() {
  const settings = await getSiteSettings()
  const nav: { label: string; href: string }[] = settings?.nav ?? []
  const siteName: string = settings?.siteName ?? 'Considerate Systems'

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="font-bold text-lg text-gray-900">{siteName}</a>
        <nav className="hidden md:flex items-center gap-6">
          {nav.map(({ label, href }) => (
            <a key={href} href={href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
```

**`app/src/components/layout/Footer.tsx`**
```tsx
import { getSiteSettings } from '../../lib/payload'

export async function Footer() {
  const settings = await getSiteSettings()
  const footer   = settings?.footer ?? {}
  const siteName = settings?.siteName ?? 'Considerate Systems'

  return (
    <footer className="bg-gray-950 text-gray-400 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div>
          <p className="text-white font-bold mb-1">{siteName}</p>
          {footer.tagline && <p className="text-sm">{footer.tagline}</p>}
          {footer.email   && (
            <a href={`mailto:${footer.email}`} className="text-sm text-blue-400 hover:text-blue-300 mt-2 block">
              {footer.email}
            </a>
          )}
        </div>

        {footer.social && footer.social.length > 0 && (
          <div className="flex gap-4 items-start">
            {footer.social.map(({ platform, url }: { platform: string; url: string }) => (
              <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                 className="text-sm capitalize hover:text-white transition-colors">
                {platform}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-gray-800 text-xs text-gray-600">
        © {new Date().getFullYear()} {siteName}. All rights reserved.
      </div>
    </footer>
  )
}
```

---

## 7. The Dynamic Page Route

This is what wires Payload Blocks to your components. Replace `app/src/app/(frontend)/page.tsx` with a dynamic route at `app/src/app/(frontend)/[[...slug]]/page.tsx`:

```tsx
import { notFound }       from 'next/navigation'
import { getPage }        from '../../../lib/payload'
import { Hero }           from '../../../components/blocks/Hero'
import { ProjectsGrid }   from '../../../components/blocks/ProjectsGrid'
import { CTABlock }       from '../../../components/blocks/CTABlock'

// Maps Payload block slugs to React components
const BLOCKS: Record<string, React.ComponentType<any>> = {
  hero:      Hero,
  projects:  ProjectsGrid,
  cta:       CTABlock,
}

interface Props {
  params: { slug?: string[] }
}

export default async function Page({ params }: Props) {
  const slug = params.slug?.join('/') ?? '/'
  const page = await getPage(slug === '' ? '/' : `/${slug}`)

  if (!page) notFound()

  return (
    <main>
      {page.layout?.map((block: any, i: number) => {
        const Block = BLOCKS[block.blockType]
        if (!Block) return null
        return <Block key={i} {...block} />
      })}
    </main>
  )
}

export async function generateMetadata({ params }: Props) {
  const slug = params.slug?.join('/') ?? '/'
  const page = await getPage(slug === '' ? '/' : `/${slug}`)
  return {
    title:       page?.seo?.title       ?? page?.title,
    description: page?.seo?.description ?? undefined,
  }
}
```

---

## 8. Layout Wrapper

Update `app/src/app/layout.tsx` to include Nav and Footer on every page:

```tsx
import { Nav }    from '../components/layout/Nav'
import { Footer } from '../components/layout/Footer'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  )
}
```

---

## 9. Styling

This guide uses Tailwind CSS utility classes. Install it if not already present:

```sh
cd app
npm install -D tailwindcss @tailwindcss/typography postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:
```js
export default {
  content: ['./src/**/*.{ts,tsx}'],
  plugins: [require('@tailwindcss/typography')],
}
```

`globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 10. Adding a New Block (Template Pattern)

When a new component type is needed for a client:

1. **Define the block schema** in `app/src/blocks/YourBlock.ts` (fields, slug, label)
2. **Add it to the `Pages` collection** `blocks` array in `Pages.ts`
3. **Write the React component** in `app/src/components/blocks/YourBlock.tsx`
4. **Register it** in the `BLOCKS` map in `[[...slug]]/page.tsx`
5. **Run a migration** (`payload migrate:create`, `payload migrate`)

That's the entire pattern. Steps 1 and 3 are the only creative work — the rest is mechanical wiring.
