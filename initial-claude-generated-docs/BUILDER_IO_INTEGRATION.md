# Builder.io + Payload Integration Cheat Sheet

## 1. Get Builder.io API Key

```bash
# Sign up at builder.io, create a space, then:
# Settings > API Tokens
BUILDER_API_KEY="your-api-key"
```

## 2. Connect Payload API to Builder (Custom Integration)

In your Next.js app's `[...slug].tsx`:

```typescript
import { BuilderComponent, builder, useIsPreviewing } from '@builder.io/react';
import fetch from 'isomorphic-fetch';

builder.init(process.env.NEXT_PUBLIC_BUILDER_API_KEY);

interface PageProps {
  builderJson: any;
  pageParams: string[];
}

export default function Page({ builderJson, pageParams }: PageProps) {
  const isPreviewing = useIsPreviewing();

  if (!builderJson && !isPreviewing) {
    return <div>Page not found</div>;
  }

  return (
    <BuilderComponent
      model="page"
      content={builderJson}
      data={{
        // Pass Payload data as context
        projects: [], // Will be fetched from Payload
      }}
    />
  );
}

export async function getStaticProps({ params }: any) {
  const pageUrl = `/${params.slug?.join('/') || ''}`;

  // Fetch from Builder
  const builderModelResults = await fetch(
    `https://cdn.builder.io/api/v1/pages?model=page&url=${encodeURIComponent(
      pageUrl
    )}&apiKey=${process.env.BUILDER_API_KEY}`
  ).then((res) => res.json());

  const builderPage = builderModelResults.results?.[0];

  // Fetch from Payload if component needs data
  let projectsData = [];
  if (builderPage?.data?.showProjects) {
    projectsData = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/projects`
    )
      .then((res) => res.json())
      .catch(() => []);
  }

  return {
    props: {
      builderJson: builderPage || null,
      projects: projectsData,
    },
    revalidate: 60, // ISR: regenerate every 60 seconds
  };
}

export async function getStaticPaths() {
  // Build known pages, or set fallback to true
  return {
    paths: [
      { params: { slug: [] } }, // /
      { params: { slug: ['about'] } }, // /about
      { params: { slug: ['projects'] } }, // /projects
    ],
    fallback: 'blocking', // Generate other pages on-demand
  };
}
```

## 3. Set Up Custom Components in Builder

Create a `components/MyProjects.tsx` component that Builder can use:

```typescript
// components/MyProjects.tsx
import React from 'react';

interface Project {
  id: string;
  title: string;
  description: string;
  image?: {
    url: string;
  };
  technologies: string[];
}

interface MyProjectsProps {
  title?: string;
  projects: Project[];
  layout?: 'grid' | 'list';
}

export const MyProjects: React.FC<MyProjectsProps> = ({
  title = 'My Projects',
  projects = [],
  layout = 'grid',
}) => {
  return (
    <section className="projects">
      <h2>{title}</h2>

      <div className={`projects-${layout}`}>
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            {project.image && (
              <img src={project.image.url} alt={project.title} />
            )}
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <div className="technologies">
              {project.technologies.map((tech) => (
                <span key={tech} className="tech-badge">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .projects {
          padding: 2rem;
        }
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }
        .projects-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .project-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1rem;
          transition: transform 0.2s;
        }
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .project-card img {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 4px;
          margin-bottom: 1rem;
        }
        .technologies {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        .tech-badge {
          background: #f0f0f0;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.85rem;
        }
      `}</style>
    </section>
  );
};

export default MyProjects;
```

Register in Builder:

```typescript
// pages/_document.tsx
import { Builder } from '@builder.io/react';
import MyProjects from '../components/MyProjects';

Builder.registerComponent(MyProjects, {
  name: 'MyProjects',
  inputs: [
    {
      name: 'title',
      type: 'string',
      defaultValue: 'My Projects',
    },
    {
      name: 'projects',
      type: 'list',
      defaultValue: [],
      subFields: [
        { name: 'id', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'text' },
        { name: 'image', type: 'object' },
        { name: 'technologies', type: 'list' },
      ],
    },
    {
      name: 'layout',
      type: 'enum',
      enum: ['grid', 'list'],
      defaultValue: 'grid',
    },
  ],
});
```

## 4. Fetch Payload Data in Builder Pages

Create a custom API endpoint in Payload:

```typescript
// src/endpoints/index.ts
import { Endpoint } from 'payload/config';

export const getAllProjects: Endpoint = {
  path: '/projects-api',
  method: 'get',
  handler: async (req, res) => {
    const payload = req.payload;

    const projects = await payload.find({
      collection: 'projects',
    });

    res.status(200).json(projects);
  },
};
```

Then in Builder's custom integrations, create a data source:

```javascript
// In Builder, Settings > Custom integrations
{
  "name": "getPayloadProjects",
  "url": "https://your-api.com/api/projects-api",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer YOUR_PAYLOAD_API_TOKEN"
  }
}
```

## 5. Environment Variables

`.env.local`:
```
NEXT_PUBLIC_BUILDER_API_KEY=your-builder-api-key
NEXT_PUBLIC_API_URL=http://localhost:3000
PAYLOAD_SECRET=your-payload-secret
DATABASE_URI=postgresql://user:pass@localhost:5432/payload_db
```

## 6. Deploy to AWS

Once in production on your EC2 instance:

```bash
# Update env vars
cat >> /var/www/portfolio/.env << EOF
NEXT_PUBLIC_BUILDER_API_KEY=$BUILDER_API_KEY
NEXT_PUBLIC_API_URL=https://yourdomain.com
EOF

# Rebuild and restart
pm2 restart portfolio
```

## 7. Common Builder Patterns

### Pattern 1: Dynamically Fetch & Render Projects

```typescript
// In a Builder custom component
export const ProjectShowcase = async ({ filter }: { filter?: string }) => {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/projects?where[category][$eq]=${filter}`
  );
  const { docs } = await res.json();

  return (
    <div className="showcase">
      {docs.map((project: any) => (
        <div key={project.id} className="project">
          {/* Render project */}
        </div>
      ))}
    </div>
  );
};
```

### Pattern 2: Builder Data Binding

In the page editor:
```
{{ getPayloadProjects() }}  // Custom integration call
{{ projects[0].title }}      // Bind to a specific project
```

### Pattern 3: Conditional Rendering

```typescript
{
  "@type": "@builder.io/sdk:Element",
  "component": {
    "name": "Box",
    "options": {
      "show": "{{ projects.length > 0 }}"
    }
  }
}
```

## 8. Debugging

Builder preview URL:
```
https://your-site.com?builder.preview=page
```

View Builder content JSON:
```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://cdn.builder.io/api/v1/pages?model=page&url=/projects
```

## 9. Performance Tips

- Enable ISR (Incremental Static Regeneration) in Next.js:
  ```typescript
  revalidate: 60 // Regenerate every 60 seconds
  ```

- Cache Payload API responses in CloudFront
- Use Builder's built-in caching headers
- Lazy load custom components

## 10. Launch Checklist

- [ ] Builder space created & API key saved
- [ ] Custom components registered
- [ ] Payload collections configured
- [ ] Pages published in Builder
- [ ] Environment variables set in `.env.local`
- [ ] Test locally: `npm run dev`
- [ ] Deploy to EC2
- [ ] Verify pages render at https://yourdomain.com
- [ ] Check Core Web Vitals
