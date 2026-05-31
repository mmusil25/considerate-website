# Development Workflow

There are three modes. You pick the one that matches what you're trying to do.

---

## The Three Modes

| Mode | When to use | Speed |
|---|---|---|
| **1. Local dev** | Day-to-day code changes, UI work, schema changes | Fast — hot reload |
| **2. Docker Compose** | Testing the production build before pushing | Slow — full Docker build |
| **3. ECS** | Shipping to production | One-time push per release |

**The answer to your question:** Write code locally (Mode 1). You do NOT need Docker to develop. You only wrap in Docker when you're ready to ship. Docker Compose exists to verify the production build works on your machine before trusting it to AWS.

---

## One-Time Setup (do this once per machine)

### 1. Install dependencies

```sh
cd ~/code/considerate-website/app
npm install
```

If you ever see `Cannot find package '...'`, run this again — it means node_modules is out of sync with package.json.

### 2. Create your local `.env`

```sh
cp docker/.env.example app/.env
```

Then edit `app/.env` and change the S3 endpoint to point at localhost (since you're running MinIO locally, not inside Docker):

```
DATABASE_URL=postgresql://payload:payload@localhost:5432/payload
DATABASE_SSL=false
PAYLOAD_SECRET=dev-secret-change-me
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000
S3_BUCKET=media
S3_PREFIX=
S3_ENDPOINT=http://localhost:9000
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
RUN_MIGRATIONS=false
NODE_ENV=development
```

The key difference from `.env.example`: `localhost` instead of service names like `db` and `minio` (those names only resolve inside Docker's network).

### 3. Start the backing services (Postgres + MinIO)

You need a database and an S3-compatible store running. Docker handles both — but you're only starting the services, not the app itself:

```sh
cd ~/code/considerate-website/docker
docker compose up db minio createbuckets -d
```

This starts Postgres on port 5432 and MinIO on port 9000. They persist across restarts via Docker volumes. You only need to run this once — after that they survive machine reboots as long as Docker is running.

Verify Postgres is up:
```sh
psql postgresql://payload:payload@localhost:5432/payload -c '\l'
```

MinIO console (optional): http://localhost:9001 — login `minioadmin` / `minioadmin`

### 4. Run existing migrations against the local DB

```sh
cd ~/code/considerate-website/app
npx payload migrate
```

---

## Mode 1: Local Dev (daily work)

Start the Next.js dev server. This gives you hot reload — edit a file, the browser updates instantly.

```sh
cd ~/code/considerate-website/app
npm run dev
```

- App: http://localhost:3000
- Admin: http://localhost:3000/admin

**The backing services (Postgres + MinIO) must already be running** from setup step 3. If they're not:
```sh
cd ~/code/considerate-website/docker && docker compose up db minio createbuckets -d
```

---

## Mode 2: Docker Compose (production parity test)

Use this before pushing to ECS to catch issues that only appear in the production build — missing env vars, build errors, migration problems.

```sh
cd ~/code/considerate-website/docker
docker compose up --build
```

This builds the full production Docker image and runs the entire stack: Postgres → MinIO → migrations → app. It uses the same Dockerfile that ECS uses. Takes a few minutes.

- App: http://localhost:3000
- Admin: http://localhost:3000/admin

Tear it down when done (keeps volumes):
```sh
docker compose down
```

Tear it down and wipe the database (fresh start):
```sh
docker compose down -v
```

---

## Mode 3: Push to ECS (ship to production)

Do this after Mode 1 or 2 confirms everything works.

```sh
cd ~/code/considerate-website

ECR_URL=481923712132.dkr.ecr.us-east-2.amazonaws.com/considerate-site

# Re-authenticate (ECR tokens expire after 12 hours)
aws ecr get-login-password --region us-east-2 \
  | sg docker -c "docker login --username AWS --password-stdin $ECR_URL"

# Build both images from repo root
sg docker -c "docker build -f docker/Dockerfile -t $ECR_URL:latest ."
sg docker -c "docker build -f docker/Dockerfile --target migrator -t $ECR_URL:migrator ."

# Push
sg docker -c "docker push $ECR_URL:latest"
sg docker -c "docker push $ECR_URL:migrator"
```

Then go to the ECS deployment steps below.

---

## The Schema Change Workflow

This is the most important sequence to get right. A schema change means you modified a Payload collection or global — added a field, changed a type, added a new collection.

### Locally (Mode 1)

```sh
# 1. Make your changes to the collection file

# 2. Generate a migration file — describes the DB changes in SQL
cd ~/code/considerate-website/app
npx payload migrate:create --name describe_what_changed

# 3. Apply the migration to your local DB
npx payload migrate

# 4. Verify the admin panel reflects the change
# http://localhost:3000/admin

# 5. Commit the generated migration files — they MUST travel with the code
git add src/migrations/
git commit -m "add migration: describe_what_changed"
```

The files in `app/src/migrations/` are the source of truth for the DB schema. Never delete or edit them manually. They travel with the code into Docker and run on ECS via the migrator task.

### On ECS (after committing)

```sh
cd ~/code/considerate-website

# Build and push new images (migrations are baked in)
ECR_URL=481923712132.dkr.ecr.us-east-2.amazonaws.com/considerate-site
sg docker -c "docker build -f docker/Dockerfile -t $ECR_URL:latest ."
sg docker -c "docker build -f docker/Dockerfile --target migrator -t $ECR_URL:migrator ."
sg docker -c "docker push $ECR_URL:latest"
sg docker -c "docker push $ECR_URL:migrator"

# Run the migrator task FIRST — updates the RDS schema
cd terraform
APP_NAME=$(terraform output -raw app_name)
SUBNET_1=$(terraform output -raw public_subnet_1_id)
SUBNET_2=$(terraform output -raw public_subnet_2_id)
APP_SG=$(terraform output -raw app_security_group_id)

aws ecs run-task \
  --cluster ${APP_NAME}-cluster \
  --task-definition ${APP_NAME} \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_1},${SUBNET_2}],securityGroups=[${APP_SG}],assignPublicIp=ENABLED}" \
  --overrides "{\"containerOverrides\":[{\"name\":\"${APP_NAME}\",\"image\":\"${ECR_URL}:migrator\",\"environment\":[{\"name\":\"RUN_MIGRATIONS\",\"value\":\"true\"}]}]}" \
  --count 1

# Watch for "migrations up to date" in the logs, then Ctrl+C
aws logs tail /ecs/${APP_NAME} --follow

# THEN deploy the new app image
aws ecs update-service \
  --cluster ${APP_NAME}-cluster \
  --service ${APP_NAME}-service \
  --force-new-deployment
```

**Order is critical:** migrator first, app second. The new app code expects the new schema. If the app deploys before migrations run, it will crash on startup.

---

## Quick Reference

| What you want to do | Command |
|---|---|
| Start local dev | `cd app && npm run dev` |
| Start backing services | `cd docker && docker compose up db minio createbuckets -d` |
| Stop backing services | `cd docker && docker compose stop db minio` |
| Apply migrations locally | `cd app && npx payload migrate` |
| Create a migration | `cd app && npx payload migrate:create --name my_change` |
| Test production build locally | `cd docker && docker compose up --build` |
| Push to ECS (no schema change) | build + push `:latest` → `ecs update-service --force-new-deployment` |
| Push to ECS (schema changed) | build + push both images → run migrator task → `ecs update-service` |
| Fix "Cannot find package" error | `cd app && npm install` |
| Wipe local DB and start fresh | `cd docker && docker compose down -v && docker compose up db minio createbuckets -d` |
