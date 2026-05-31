# Payload Admin Setup Guide

This guide covers configuring the Payload admin panel for the Considerate Systems LLC site and as a reusable template. It assumes the stack is already running (Docker + RDS + ECS or local compose).

---

## 1. First Login

Navigate to `/admin` and create the first admin user. This user is created directly in the database — there is no "default" password. Fill in name, email, and a strong password. This becomes the owner account.

For client sites: create the owner account yourself during setup, then invite the client via Payload's built-in user invite (or create their account and hand off credentials securely).

---

## 2. What's Already in the Codebase

`app/src/payload.config.ts` already defines:

| Collection | Purpose |
|---|---|
| `users` | Admin accounts (auth enabled) |
| `media` | File uploads → routed to S3 |
| `projects` | LLC portfolio items |

`app/src/collections/Projects.ts` has: `title`, `slug`, `description`, `image` (upload), `technologies` (array), `publishedAt`.

---

## 3. Enhance the Projects Collection

Replace `app/src/collections/Projects.ts` with a richer schema suited to an agency portfolio:

```typescript
import type { CollectionConfig } from 'payload'

const Projects: CollectionConfig = {
  slug: 'projects',
  auth: false,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'publishedAt', 'featured'],
    group: 'Portfolio',
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    { name: 'title',       type: 'text',     required: true },
    { name: 'slug',        type: 'text',     required: true, unique: true,
      admin: { description: 'URL-safe identifier, e.g. "bakery-rebrand"' } },
    { name: 'client',      type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'body',        type: 'richText' },  // full case study content
    { name: 'image',       type: 'upload',   relationTo: 'media' },
    { name: 'gallery',     type: 'array',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] },
    { name: 'technologies', type: 'array',
      fields: [{ name: 'tech', type: 'text' }] },
    { name: 'liveUrl',     type: 'text',
      admin: { description: 'Link to the live site (optional)' } },
    { name: 'featured',    type: 'checkbox', defaultValue: false,
      admin: { description: 'Show on homepage' } },
    { name: 'publishedAt', type: 'date',     defaultValue: () => new Date().toISOString() },
  ],
}

export default Projects
```

After saving, run a migration to apply the schema change:

```sh
# locally
cd app && npx payload migrate:create --name add_projects_enhancements
npx payload migrate

# on ECS (Fargate) — build + push :migrator image, then run-task as per README step 5
```

---

## 4. Add a Pages Collection with Blocks

This is the self-hosted answer to Builder.io for 99% of clients. Editors assemble pages by stacking pre-defined blocks in Payload's admin — no code required on their end.

Create `app/src/collections/Pages.ts`:

```typescript
import type { CollectionConfig } from 'payload'
import { HeroBlock }      from '../blocks/Hero'
import { ProjectsBlock }  from '../blocks/Projects'
import { RichTextBlock }  from '../blocks/RichText'
import { CTABlock }       from '../blocks/CTA'

const Pages: CollectionConfig = {
  slug: 'pages',
  auth: false,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    group: 'Content',
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    { name: 'title',  type: 'text', required: true },
    { name: 'slug',   type: 'text', required: true, unique: true,
      admin: { description: 'Use "/" for the homepage' } },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [HeroBlock, ProjectsBlock, RichTextBlock, CTABlock],
      admin: { description: 'Assemble the page by adding blocks below' },
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title',       type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'image',       type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}

export default Pages
```

Then create the block definitions. Create `app/src/blocks/` and add one file per block (see the React Components Guide for the corresponding React components):

**`app/src/blocks/Hero.ts`**
```typescript
import type { Block } from 'payload'

export const HeroBlock: Block = {
  slug: 'hero',
  labels: { singular: 'Hero', plural: 'Heroes' },
  fields: [
    { name: 'heading',    type: 'text',     required: true },
    { name: 'subheading', type: 'text' },
    { name: 'ctaLabel',   type: 'text' },
    { name: 'ctaHref',    type: 'text' },
    { name: 'image',      type: 'upload',   relationTo: 'media' },
    { name: 'align',      type: 'select',
      options: ['left', 'center'], defaultValue: 'center' },
  ],
}
```

**`app/src/blocks/Projects.ts`**
```typescript
import type { Block } from 'payload'

export const ProjectsBlock: Block = {
  slug: 'projects',
  labels: { singular: 'Projects Grid', plural: 'Projects Grids' },
  fields: [
    { name: 'heading',      type: 'text' },
    { name: 'featuredOnly', type: 'checkbox', defaultValue: true,
      admin: { description: 'Only show projects marked "featured"' } },
    { name: 'limit',        type: 'number',   defaultValue: 6 },
    { name: 'layout',       type: 'select',
      options: ['grid', 'list'], defaultValue: 'grid' },
  ],
}
```

**`app/src/blocks/RichText.ts`**
```typescript
import type { Block } from 'payload'

export const RichTextBlock: Block = {
  slug: 'richText',
  labels: { singular: 'Rich Text', plural: 'Rich Text Blocks' },
  fields: [
    { name: 'content', type: 'richText', required: true },
    { name: 'width',   type: 'select',
      options: ['narrow', 'full'], defaultValue: 'narrow' },
  ],
}
```

**`app/src/blocks/CTA.ts`**
```typescript
import type { Block } from 'payload'

export const CTABlock: Block = {
  slug: 'cta',
  labels: { singular: 'Call to Action', plural: 'Calls to Action' },
  fields: [
    { name: 'heading',     type: 'text', required: true },
    { name: 'body',        type: 'textarea' },
    { name: 'buttonLabel', type: 'text' },
    { name: 'buttonHref',  type: 'text' },
    { name: 'style',       type: 'select',
      options: ['light', 'dark'], defaultValue: 'dark' },
  ],
}
```

Register Pages in `payload.config.ts`:

```typescript
import Pages from './collections/Pages.ts'
// add Pages to the collections array alongside Projects
collections: [..., Pages],
```

---

## 5. Add a Site Settings Global

Globals are singleton documents — perfect for nav links, footer content, contact info, and social links that appear on every page.

Create `app/src/globals/SiteSettings.ts`:

```typescript
import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  admin: { group: 'Configuration' },
  access: { read: () => true },
  fields: [
    { name: 'siteName',   type: 'text' },
    { name: 'logo',       type: 'upload', relationTo: 'media' },
    {
      name: 'nav',
      type: 'array',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href',  type: 'text' },
      ],
    },
    {
      name: 'footer',
      type: 'group',
      fields: [
        { name: 'tagline', type: 'text' },
        { name: 'email',   type: 'email' },
        {
          name: 'social',
          type: 'array',
          fields: [
            { name: 'platform', type: 'select',
              options: ['linkedin', 'github', 'twitter', 'instagram'] },
            { name: 'url', type: 'text' },
          ],
        },
      ],
    },
  ],
}
```

Register in `payload.config.ts`:

```typescript
import { SiteSettings } from './globals/SiteSettings.ts'
// add a globals key to buildConfig
globals: [SiteSettings],
```

---

## 6. Admin Customization Tips

Add these to `buildConfig` to make the admin panel feel polished for clients:

```typescript
export default buildConfig({
  admin: {
    user: 'users',
    meta: {
      titleSuffix: '— Considerate Systems',
      // favicon: '/favicon.ico',  // place in app/public/
    },
    // Group collections in the sidebar
  },
  // ...
})
```

The `admin.group` field on each collection (set in step 3 and 4 above) automatically organizes the left sidebar into sections: **Portfolio**, **Content**, **Configuration**.

---

## 7. Run Migrations After Schema Changes

Every time you modify a collection or global:

```sh
# Generate + run locally
cd app
npx payload migrate:create --name describe_the_change
npx payload migrate

# Commit the generated migration files
git add src/migrations/
git commit -m "add migration: describe_the_change"
```

Then build + push new images and run the `:migrator` ECS task before deploying the new `:latest` image. See README step 5.
