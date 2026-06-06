#!/usr/bin/env bash
# =============================================================================
# Deploy the app: build -> push -> MIGRATE -> roll out.
#
# The migrate step is the important one. It runs the Terraform-managed migrator
# task (`<app_name>-migrator`, the :migrator image) to completion and ABORTS the
# deploy if it fails — so a pending/broken DB migration stops the rollout loudly
# instead of silently 500-ing the admin after the new code is already live.
#
# All config is read from `terraform output`, so this is not pinned to one site.
#
# Usage:  scripts/deploy.sh            # build, migrate, deploy
#         SKIP_BUILD=1 scripts/deploy.sh   # reuse current :latest/:migrator, just migrate+roll
#
# Caveat: this applies COMMITTED migrations. It does not detect a migration you
# forgot to generate (`payload migrate:create`) — run that in dev when you add or
# change a collection/field, and commit the result.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
TF="$ROOT/terraform"

tfout() { terraform -chdir="$TF" output -raw "$1"; }

echo "==> Reading Terraform outputs"
ECR_URL="$(tfout ecr_repository_url)"
REGION="$(tfout aws_region)"
APP="$(tfout app_name)"
MIGRATOR_FAMILY="$(tfout migrator_task_definition_family)"
SUBNET1="$(tfout public_subnet_1_id)"
SUBNET2="$(tfout public_subnet_2_id)"
APP_SG="$(tfout app_security_group_id)"
CLUSTER="${APP}-cluster"
SERVICE="${APP}-service"
RUNNER_TAG="${RUNNER_TAG:-latest}"
MIGRATOR_TAG="${MIGRATOR_TAG:-migrator}"

echo "    app=$APP region=$REGION cluster=$CLUSTER service=$SERVICE"

# --- build + push -----------------------------------------------------------
# Next's "Collecting build traces" (@vercel/nft) can segfault intermittently;
# retry a couple of times before giving up.
build_with_retry() {
  local target="$1" tag="$2" log
  log="$(mktemp)"
  for attempt in 1 2 3; do
    echo "==> Building $target image (attempt $attempt) -> $ECR_URL:$tag"
    if docker build -f docker/Dockerfile --target "$target" -t "$ECR_URL:$tag" . >"$log" 2>&1; then
      return 0
    fi
    if grep -q 'Segmentation fault' "$log"; then
      echo "    transient NFT segfault, retrying..." >&2
      continue
    fi
    echo "!!! build failed:" >&2; tail -25 "$log" >&2
    return 1
  done
  echo "!!! build still failing after retries" >&2; tail -25 "$log" >&2
  return 1
}

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> ECR login"
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "$ECR_URL" >/dev/null
  build_with_retry runner   "$RUNNER_TAG"
  build_with_retry migrator "$MIGRATOR_TAG"
  echo "==> Pushing images"
  docker push "$ECR_URL:$RUNNER_TAG"   >/dev/null
  docker push "$ECR_URL:$MIGRATOR_TAG" >/dev/null
else
  echo "==> SKIP_BUILD=1 — using existing :$RUNNER_TAG / :$MIGRATOR_TAG"
fi

# --- migrate (the gate) -----------------------------------------------------
echo "==> Running migrations ($MIGRATOR_FAMILY) — rollout is blocked until this succeeds"
NETCFG="awsvpcConfiguration={subnets=[$SUBNET1,$SUBNET2],securityGroups=[$APP_SG],assignPublicIp=ENABLED}"
TASK_ARN="$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$MIGRATOR_FAMILY" \
  --launch-type FARGATE --network-configuration "$NETCFG" \
  --started-by "deploy.sh" --region "$REGION" \
  --query 'tasks[0].taskArn' --output text)"
TID="${TASK_ARN##*/}"
echo "    migrate task: $TID — waiting..."
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION"

EXIT_CODE="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION" \
  --query 'tasks[0].containers[0].exitCode' --output text)"

# Migrator logs to group /ecs/<app>, stream prefix "migrate".
LOG_GROUP="/ecs/$APP"
LOG_STREAM="migrate/${MIGRATOR_FAMILY}/${TID}"
echo "----- migrate output -----"
aws logs get-log-events --log-group-name "$LOG_GROUP" --log-stream-name "$LOG_STREAM" \
  --region "$REGION" --query 'events[*].message' --output text 2>/dev/null \
  | tr '\t' '\n' | sed 's/\x1b\[[0-9;]*m//g' | grep -vE '^\s*$' || true
echo "--------------------------"

if [ "$EXIT_CODE" != "0" ]; then
  echo "!!! MIGRATION FAILED (exit=$EXIT_CODE). Aborting deploy — app NOT rolled out." >&2
  exit 1
fi
echo "==> Migrations OK"

# --- roll out ---------------------------------------------------------------
echo "==> Rolling out app service ($SERVICE)"
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" \
  --force-new-deployment --region "$REGION" >/dev/null
echo "    waiting for service to stabilize..."
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION"

echo "==> Deploy complete. Service is stable on the new image."
