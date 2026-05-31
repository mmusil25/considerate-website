# ConsiderateSystems.com Website

This repo defines a turnkey way of setting up a Payload + Next.js website on Amazon web services. Most modern content management systems make starting a new website inexpensive, then jack up the hosting fees once you get real traffic. Vercel is just as bad. This system seeks to flip the script from "start small, pay big when you grow" to "start small, pay less per user as you grow" which is much more appealing to most small and medium sized business owners. 

This website assumes that you will be using Builder.io for page design. Most Small-to-medium sized businesses need website that host both content (blogs, products, videos) as well as 

## Prerequisites

- **AWS account** with permissions to create VPC, ECS, RDS, S3, ACM, Route53, and IAM resources
- **AWS CLI** installed and configured (`aws configure`)
- **Terraform** >= 1.0
- **Docker** installed, with your user in the `docker` group (Linux: `sudo usermod -aG docker $USER`, then log out/in or run `newgrp docker`)
- **Domain name** — purchased via Route53 console (for full automation) or any registrar (manual DNS step required)

## Steps to stand up a new website:

### 1. Set up vars

Copy `terraform/example.terraform.tfvars` → `terraform/terraform.tfvars` and fill in your values. Key fields:

```hcl
app_name        = "my-site"
db_password     = "choose-a-strong-password"
domain_name     = "example.com"
use_route53     = true    # false if domain is at an external registrar
container_image = "placeholder"   # updated after step 3
```

### 2. Bootstrap ECR

ECR must exist before you can push an image. Create it alone first:

```sh
cd terraform && terraform init
terraform apply -target=aws_ecr_repository.app
```

Copy the `ecr_repository_url` from the output.

### 3. Build and push

Still inside `terraform/` from step 2:

```sh
# Grab the ECR URL from Terraform output
ECR_URL=$(terraform output -raw ecr_repository_url)

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-2 \
  | docker login --username AWS --password-stdin $ECR_URL

# Return to repo root — docker build context must be here (Dockerfile is in docker/)
cd ..
docker build -f docker/Dockerfile -t $ECR_URL:latest .
docker build -f docker/Dockerfile --target migrator -t $ECR_URL:migrator .
docker push $ECR_URL:latest
docker push $ECR_URL:migrator
```

> **Note:** If you ran `newgrp docker` to fix Docker permissions, that starts a fresh shell and clears `$ECR_URL`. Re-set it before building: `ECR_URL=$(cd terraform && terraform output -raw ecr_repository_url)`

Then update `container_image` in `terraform.tfvars` with the value of `$ECR_URL`.

### 4. Apply all infrastructure

```sh
cd terraform/
terraform apply

# Refresh outputs.json in the repo root after every apply
terraform output -json > ../outputs.json
```

Note the `alb_dns_name` output — that's your site's address.

### 5. Run migrations (first deploy only)

The ECS service starts with `RUN_MIGRATIONS=false` to prevent multiple containers racing on the same DB. Run migrations once as a standalone task before traffic hits the service.

From inside `terraform/`:

```sh
APP_NAME=$(terraform output -raw app_name)
SUBNET_1=$(terraform output -raw public_subnet_1_id)
SUBNET_2=$(terraform output -raw public_subnet_2_id)
APP_SG=$(terraform output -raw app_security_group_id)

ECR_URL=$(terraform output -raw ecr_repository_url)

aws ecs run-task \
  --cluster ${APP_NAME}-cluster \
  --task-definition ${APP_NAME} \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_1},${SUBNET_2}],securityGroups=[${APP_SG}],assignPublicIp=ENABLED}" \
  --overrides "{\"containerOverrides\":[{\"name\":\"${APP_NAME}\",\"image\":\"${ECR_URL}:migrator\",\"environment\":[{\"name\":\"RUN_MIGRATIONS\",\"value\":\"true\"}]}]}" \
  --count 1
```

Watch the logs to confirm migrations complete before moving on:

```sh
aws logs tail /ecs/${APP_NAME} --follow
```

### 6. Wire DNS

**Route53 (`use_route53 = true`):** `terraform apply` handled it automatically — skip to step 7.

**External DNS (`use_route53 = false`):**
1. Note the `acm_validation_records` output from `terraform apply`
2. Add those CNAMEs at your registrar to validate the ACM cert
3. Add an A record (or CNAME) pointing your domain to `alb_dns_name`
4. Wait for the cert to issue (~5–30 min)
5. Set `cert_issued = true` in `terraform.tfvars` and re-run `terraform apply`

### 7. Verify

Hit `http://<alb_dns_name>` and `http://<alb_dns_name>/admin`.



## Tearing Down

Destroys all AWS resources provisioned by Terraform. **Irreversible — RDS data and S3 objects will be permanently deleted.**

```sh
cd terraform && terraform destroy
```

Terraform will show a plan and ask for confirmation before deleting anything.

## Architecture Diagram 

![arch](img/Turn-key-Payload.drawio.png)


## Resources Provisioned



| Resource | Type | Name/Identifier | Key Details |
|---|---|---|---|
| VPC | `aws_vpc` | `{app_name}-vpc` | CIDR `10.0.0.0/16`, DNS hostnames enabled |
| Public Subnet 1 | `aws_subnet` | `{app_name}-public-1` | `10.0.1.0/24`, AZ[0], public IP on launch |
| Public Subnet 2 | `aws_subnet` | `{app_name}-public-2` | `10.0.2.0/24`, AZ[1], public IP on launch |
| Private Subnet 1 | `aws_subnet` | `{app_name}-private-1` | `10.0.10.0/24`, AZ[0], no public IP (RDS only) |
| Private Subnet 2 | `aws_subnet` | `{app_name}-private-2` | `10.0.11.0/24`, AZ[1], no public IP (RDS only) |
| Internet Gateway | `aws_internet_gateway` | `{app_name}-igw` | Attached to main VPC |
| Public Route Table | `aws_route_table` | `{app_name}-public-rt` | Default route `0.0.0.0/0` → IGW |
| Route Table Assoc 1 | `aws_route_table_association` | — | Associates `public_1` with public route table |
| Route Table Assoc 2 | `aws_route_table_association` | — | Associates `public_2` with public route table |
| ALB Security Group | `aws_security_group` | `{app_name}-alb-sg` | Inbound 80/443 from internet; all egress |
| App Security Group | `aws_security_group` | `{app_name}-app-sg` | Inbound 3000 from ALB SG only; all egress |
| DB Security Group | `aws_security_group` | `{app_name}-db-sg` | Inbound 5432 from App SG only; all egress |
| DB Subnet Group | `aws_db_subnet_group` | `{app_name}-db-subnet-group` | Spans both private subnets |
| RDS Instance | `aws_db_instance` | `{app_name}-db` | Postgres 15, `var.db_instance_class`, 20 GB, private only |
| Random Password | `random_password` | `payload_secret` | 48-char alphanumeric, stored in state |
| Secrets Manager Secret | `aws_secretsmanager_secret` | `{app_name}/payload-secret` | Holds `PAYLOAD_SECRET`; 0-day recovery window |
| Secret Version | `aws_secretsmanager_secret_version` | — | Stores the random password value |
| S3 Bucket | `aws_s3_bucket` | `{app_name}-assets-{account_id}` | Media/assets bucket, force-destroy enabled |
| S3 Versioning | `aws_s3_bucket_versioning` | — | Versioning enabled on assets bucket |
| CloudFront Distribution | `aws_cloudfront_distribution` | `{app_name}-cdn` | S3 origin, HTTPS redirect, 1hr default TTL |
| ECR Repository | `aws_ecr_repository` | `{app_name}` | Mutable tags, scan on push |
| CloudWatch Log Group | `aws_cloudwatch_log_group` | `/ecs/{app_name}` | 30-day retention |
| ECS Cluster | `aws_ecs_cluster` | `{app_name}-cluster` | Fargate cluster |
| ECS Execution Role | `aws_iam_role` | `{app_name}-ecs-execution-role` | Allows ECS agent to pull ECR images, write logs, read secrets |
| Execution Role Attachment | `aws_iam_role_policy_attachment` | — | Attaches `AmazonECSTaskExecutionRolePolicy` |
| Execution Secrets Policy | `aws_iam_role_policy` | `{app_name}-ecs-execution-secrets` | Grants `GetSecretValue` on `PAYLOAD_SECRET` |
| ECS Task Role | `aws_iam_role` | `{app_name}-ecs-task-role` | Runtime role for the app process |
| Task Role Policy | `aws_iam_role_policy` | `{app_name}-ecs-task-policy` | S3 `PutObject`/`GetObject`/`DeleteObject`/`ListBucket` on assets bucket |
| ALB | `aws_lb` | `{app_name}-alb` | Internet-facing, spans both public subnets |
| ALB Target Group | `aws_lb_target_group` | `{app_name}-tg` | Port 3000, IP target type, health check on `/` |
| ALB HTTP Listener | `aws_lb_listener` | — | Port 80 → forwards to target group |
| ECS Task Definition | `aws_ecs_task_definition` | `{app_name}` | Fargate, `awsvpc`, injects `PAYLOAD_SECRET` from Secrets Manager |
| ECS Service | `aws_ecs_service` | `{app_name}-service` | Fargate, `var.desired_count` tasks, public subnets with public IPs |
