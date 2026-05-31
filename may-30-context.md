# Session Context — May 30/31 2026

## Where We Left Off

Both Docker images were built locally and ready to push. The session was interrupted before pushing. Resume from here:

```sh
cd /home/mark/code/considerate-website

ECR_URL=481923712132.dkr.ecr.us-east-2.amazonaws.com/considerate-site

# Re-authenticate (tokens expire after 12h)
aws ecr get-login-password --region us-east-2 \
  | sg docker -c "docker login --username AWS --password-stdin $ECR_URL"

# Push both images
sg docker -c "docker push $ECR_URL:latest"
sg docker -c "docker push $ECR_URL:migrator"
```

Then force the service to redeploy and run migrations:

```sh
cd terraform
APP_NAME=$(terraform output -raw app_name)
SUBNET_1=$(terraform output -raw public_subnet_1_id)
SUBNET_2=$(terraform output -raw public_subnet_2_id)
APP_SG=$(terraform output -raw app_security_group_id)
ECR_URL=$(terraform output -raw ecr_repository_url)

# Force service to pick up new :latest image
aws ecs update-service --cluster ${APP_NAME}-cluster --service ${APP_NAME}-service --force-new-deployment

# Run one-off migration task using :migrator image
aws ecs run-task \
  --cluster ${APP_NAME}-cluster \
  --task-definition ${APP_NAME} \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_1},${SUBNET_2}],securityGroups=[${APP_SG}],assignPublicIp=ENABLED}" \
  --overrides "{\"containerOverrides\":[{\"name\":\"${APP_NAME}\",\"image\":\"${ECR_URL}:migrator\",\"environment\":[{\"name\":\"RUN_MIGRATIONS\",\"value\":\"true\"}]}]}" \
  --count 1

# Watch logs
aws logs tail /ecs/${APP_NAME} --follow
```

---

## Docker Group Issue

`mark` is in the `docker` group but current shell sessions predate the addition. Until you log out and back in, prefix docker commands with `sg docker -c "..."` or open a fresh terminal (which will have the group active).

---

## Infrastructure State

Site: **considerate-site** on ECS Fargate, us-east-2  
ALB: `considerate-site-alb-1090536380.us-east-2.elb.amazonaws.com`  
ECR: `481923712132.dkr.ecr.us-east-2.amazonaws.com/considerate-site`  
RDS: `considerate-site-db.cfqoee6ueqrd.us-east-2.rds.amazonaws.com:5432`  
S3: `considerate-site-assets-481923712132`  
CloudFront: `d3nzt6a9626bkq.cloudfront.net`

`terraform apply` ran but had one partial failure: Route53 A records for `consideratesystems.com` and `www.consideratesystems.com` already existed (old WordPress install). Fix before next apply:

```sh
cd terraform
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name consideratesystems.com \
  --query 'HostedZones[0].Id' --output text | sed 's|/hostedzone/||')

terraform import 'aws_route53_record.app[0]'     "${ZONE_ID}_consideratesystems.com_A"
terraform import 'aws_route53_record.app_www[0]' "${ZONE_ID}_www.consideratesystems.com_A"
terraform apply
```

---

## What Changed This Session

### New files
- `terraform/example.terraform.tfvars` — filled out template; user copies → renames to `terraform.tfvars`
- `README.md` — complete standup guide (prerequisites, 7 steps, teardown)

### terraform/variables.tf
- Added `domain_name` (default `""`)
- Added `use_route53` (default `true`) — false = external registrar
- Added `cert_issued` (default `false`) — external DNS only, flip after ACM cert validates
- Changed `public_url` default from hardcoded site URL to `""`

### terraform/main.tf
- `locals`: added `has_route53`, `has_external`, `https_active`
- HTTP listener: redirects to HTTPS only when `https_active` (not when cert is still pending)
- Route53 zone lookup, ACM cert, validation records, cert validation waiter, HTTPS listener, A records — all conditional on the appropriate flag
- New output `acm_validation_records` — CNAMEs for external DNS users
- New outputs: `app_name`, `public_subnet_1_id`, `public_subnet_2_id`, `app_security_group_id` (needed for migration RunTask command)
- ECR repo: added `force_delete = true` so `terraform destroy` works even with images present

### docker/Dockerfile
- Removed cherry-picked migration dep copies from runner stage (they caused cascading `ERR_MODULE_NOT_FOUND` errors: tsx → get-tsconfig → ...)
- Added `migrator` stage (FROM builder — has full node_modules, so all deps present). Runs migrations via entrypoint then exits with `CMD ["true"]`

### outputs.json (repo root)
- Regenerated — was stale with old EC2 outputs. Now has Fargate outputs.

---

## Known Issues / Next Steps

1. **Migrations haven't run yet** — DB schema is empty. The migrator image is built locally but not pushed yet. Do the push + run-task above.
2. **Route53 records conflict** — needs the `terraform import` above before next `terraform apply`.
3. **`terraform apply` still needs one more run** after importing Route53 records to confirm state is clean.
4. **Verify site** — after migrations succeed, hit `https://consideratesystems.com` and `/admin`.
