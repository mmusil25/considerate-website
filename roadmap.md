# Roadmap

## Shared Infrastructure (Multi-Tenancy)

**Current state:** Each client site gets its own dedicated RDS instance, ALB, and ECS cluster via a fresh `terraform apply`.

**Why this matters later:** A dedicated `db.t3.micro` costs ~\$15-20 per month. Add the ALB (~\$20 per month) and Fargate (~\$15-20/month) and each site has a ~$50-60/month fixed floor before a single user visits it. At a \$5k build price, that's 12-14% of project revenue in year one just to keep the infrastructure running — and it's your cost to explain and justify, not the client's AWS bill directly.

**The target architecture:** One shared RDS instance holds multiple Postgres databases (one per client). One ECS cluster runs multiple Fargate services (one per client). One ALB uses host-based routing rules to send `client-a.com` → service A and `client-b.com` → service B. Each client still gets their own ECR repo, S3 bucket, CloudFront distribution, and Secrets Manager entry — the stateful and identity-bearing pieces stay isolated.

**What this does to economics:** Adding client #2 through #N costs roughly: one new Fargate service (~\$15-20/month), one new S3 bucket (near-zero until traffic), one new CloudFront distribution (~\$1/month at low traffic), and a new database on the shared RDS instance (no additional cost until the shared instance needs to scale). The ALB and RDS become fixed overhead spread across all clients. At 5 clients, the per-site infrastructure cost drops from ~\$55/month to ~\$25/month. At 10 clients, closer to ~\$18/month.

**What needs to change in Terraform:**
- Split the current monolithic `main.tf` into a "shared baseline" module (VPC, RDS, ALB, cluster) applied once, and a "per-site" module (ECS service, ECR, S3, CloudFront, Route53 records, Secrets Manager entry) applied per client.
- ALB listener rules become host-header conditions instead of the default forward rule.
- RDS gets a `aws_db_instance` with a superuser account; each site gets its own Postgres database and a scoped user created via a provisioner or migration step.
- The per-site module takes `cluster_arn`, `alb_arn`, `rds_endpoint`, and `shared_sg_id` as inputs from the baseline module's outputs.

**When to do this:** When you have 3+ active client sites, or when a prospective client asks about ongoing hosting costs and the per-site number is a blocker. Before that point, the operational simplicity of isolated stacks (easier to tear down, debug, and hand off) is worth the cost premium.

---

## Builder.io Integration (Optional, Additive)

**Current state:** Payload Blocks handles page composition. Components are registered as Payload block types; editors assemble pages in the Payload admin.

**Why Builder.io is not lock-in:** Builder.io operates at the Next.js rendering layer. Your React components are plain React — adding Builder support means calling `Builder.registerComponent()` on existing components (a one-liner each) and adding a Builder content fetch to the `[...slug]` route. Payload Blocks pages are unaffected; Builder becomes an additional page source. Your content (projects, posts, team, etc.) stays in Payload regardless.

**When Builder.io makes sense:** A client needs marketing-team autonomy over landing page creation without any developer involvement — typically \$10k+ projects where that autonomy is a stated deliverable. For most \$5k sites, Payload's admin panel is sufficient and Builder's SaaS cost (~\$500/month at team tier) is hard to justify.

**Migration path when the time comes:**
1. `npm install @builder.io/sdk-react`
2. Register each existing component with `Builder.registerComponent(YourComponent, { name, inputs })`
3. In `[...slug]/page.tsx`, fetch from Builder first, fall back to Payload Blocks if no Builder content found for that URL
4. Build new pages or marketing pages in Builder; existing Payload Blocks pages continue to work unchanged
