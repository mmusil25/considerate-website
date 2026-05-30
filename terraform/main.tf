terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Fetch available AZs
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# =============================================================================
# VPC
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = {
    Name = "${var.app_name}-vpc"
  }
}

# Public Subnets (ALB + Fargate tasks with assign_public_ip)
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.app_name}-public-1"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.app_name}-public-2"
  }
}

# Private Subnets (RDS only — no outbound routing needed for the DB)
resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "${var.app_name}-private-1"
  }
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "${var.app_name}-private-2"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.app_name}-igw"
  }
}

# Route Table (Public)
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.app_name}-public-rt"
  }
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# =============================================================================
# Security Groups
# =============================================================================

# ALB: accepts inbound HTTP/HTTPS from the internet
resource "aws_security_group" "alb" {
  name   = "${var.app_name}-alb-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-alb-sg"
  }
}

# App (Fargate tasks): only the ALB can reach port 3000; tasks reach out freely
resource "aws_security_group" "app" {
  name   = "${var.app_name}-app-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-app-sg"
  }
}

# DB: only the app SG can reach Postgres
resource "aws_security_group" "db" {
  name   = "${var.app_name}-db-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-db-sg"
  }
}

# =============================================================================
# RDS PostgreSQL
# =============================================================================

resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier             = "${var.app_name}-db"
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  skip_final_snapshot    = true
  publicly_accessible    = false

  tags = {
    Name = "${var.app_name}-db"
  }
}

# =============================================================================
# Stable PAYLOAD_SECRET in Secrets Manager
#
# Generated once and stored in Terraform state — re-apply keeps the same value.
# Rotating this secret invalidates all admin sessions and breaks any encrypted
# Payload fields, so only do it deliberately.
# =============================================================================

resource "random_password" "payload_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "payload_secret" {
  name                    = "${var.app_name}/payload-secret"
  description             = "Stable PAYLOAD_SECRET for ${var.app_name}. Do NOT rotate without planning."
  recovery_window_in_days = 0  # allows immediate delete+recreate with the same name
}

resource "aws_secretsmanager_secret_version" "payload_secret" {
  secret_id     = aws_secretsmanager_secret.payload_secret.id
  secret_string = random_password.payload_secret.result
}

# =============================================================================
# S3 + CloudFront (media)
# =============================================================================

resource "aws_s3_bucket" "assets" {
  bucket        = "${var.app_name}-assets-${data.aws_caller_identity.current.account_id}"
  force_destroy = true  # allows terraform destroy even when the bucket has objects

  tags = {
    Name = "${var.app_name}-assets"
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudfront_distribution" "assets" {
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3Assets"
  }

  enabled = true

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Assets"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.app_name}-cdn"
  }
}

# =============================================================================
# ECR — stores versioned app images
# =============================================================================

resource "aws_ecr_repository" "app" {
  name                 = var.app_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.app_name}-ecr"
  }
}

# =============================================================================
# CloudWatch Logs
# =============================================================================

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 30

  tags = {
    Name = "${var.app_name}-logs"
  }
}

# =============================================================================
# ECS Cluster
# =============================================================================

resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster"

  tags = {
    Name = "${var.app_name}-cluster"
  }
}

# =============================================================================
# IAM — ECS task execution role
#
# Used by the ECS agent to: pull the image from ECR, write logs to CloudWatch,
# and inject secrets from Secrets Manager into the container at launch.
# The running app code does NOT use this role.
# =============================================================================

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.app_name}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name = "${var.app_name}-ecs-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Grant the execution role the ability to read PAYLOAD_SECRET so ECS can inject
# it into the container via the task definition's `secrets` block.
data "aws_iam_policy_document" "ecs_execution_secrets" {
  statement {
    sid       = "ReadPayloadSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.payload_secret.arn]
  }
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name   = "${var.app_name}-ecs-execution-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_secrets.json
}

# =============================================================================
# IAM — ECS task role
#
# Runtime permissions granted to the running app process: S3 read/write for
# media uploads. PAYLOAD_SECRET is injected at launch (not read at runtime).
# =============================================================================

resource "aws_iam_role" "ecs_task" {
  name               = "${var.app_name}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name = "${var.app_name}-ecs-task-role"
  }
}

data "aws_iam_policy_document" "ecs_task" {
  statement {
    sid       = "MediaObjects"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.assets.arn}/*"]
  }

  statement {
    sid       = "MediaBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.assets.arn]
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name   = "${var.app_name}-ecs-task-policy"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task.json
}

# =============================================================================
# ALB — routes internet traffic to Fargate tasks
# =============================================================================

resource "aws_lb" "main" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  tags = {
    Name = "${var.app_name}-alb"
  }
}

resource "aws_lb_target_group" "app" {
  name        = "${var.app_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # required for Fargate (awsvpc network mode)

  health_check {
    path                = "/"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200-399"
  }

  tags = {
    Name = "${var.app_name}-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # With a domain: redirect all HTTP to HTTPS. Without: forward directly.
  dynamic "default_action" {
    for_each = local.https_active ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.app.arn
    }
  }

  dynamic "default_action" {
    for_each = local.https_active ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

# =============================================================================
# ECS Task Definition
#
# Secrets Manager injects PAYLOAD_SECRET at task launch (never in logs/env dump).
# DATABASE_URL is passed as a plain env var; the password lives in Terraform state
# just as it did with the EC2 user_data approach — acceptable for a single-dev
# project but could be moved to Secrets Manager if stricter secrets hygiene is
# needed later.
# =============================================================================

locals {
  has_domain   = var.domain_name != ""
  has_route53  = local.has_domain && var.use_route53
  has_external = local.has_domain && !var.use_route53
  # HTTPS listener exists once Route53 automates it, or once user confirms cert issued
  https_active = local.has_route53 || (local.has_external && var.cert_issued)
  public_url = (
    var.public_url  != "" ? var.public_url :
    local.has_domain      ? "https://${var.domain_name}" :
    "http://${aws_lb.main.dns_name}"
  )
}

resource "aws_ecs_task_definition" "app" {
  family                   = var.app_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = var.app_name
    image     = var.container_image
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV",                  value = "production" },
      { name = "PORT",                      value = "3000" },
      { name = "DATABASE_URL",              value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}" },
      { name = "S3_BUCKET",                 value = aws_s3_bucket.assets.id },
      { name = "S3_PREFIX",                 value = var.s3_prefix },
      { name = "AWS_REGION",                value = var.aws_region },
      { name = "PAYLOAD_PUBLIC_SERVER_URL", value = local.public_url },
      # RUN_MIGRATIONS=false: run migrations as a one-off ECS RunTask (off the
      # `builder` image target) before rolling out a new app version, rather than
      # letting N replicas race to migrate the same DB at startup.
      { name = "RUN_MIGRATIONS",            value = "false" }
    ]

    secrets = [{
      name      = "PAYLOAD_SECRET"
      valueFrom = aws_secretsmanager_secret.payload_secret.arn
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 40
    }
  }])

  tags = {
    Name = "${var.app_name}-task"
  }
}

# =============================================================================
# ECS Service
# =============================================================================

resource "aws_ecs_service" "app" {
  name            = "${var.app_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.app_name
    container_port   = 3000
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_execution,
  ]

  tags = {
    Name = "${var.app_name}-service"
  }
}

# =============================================================================
# ACM + Route53 / External DNS
#
# Route53 mode (use_route53=true):  cert + DNS validation + A records are fully
#   automated. apply completes with HTTPS live.
#
# External DNS mode (use_route53=false):  cert is requested and validation CNAMEs
#   are output. User adds them at their registrar. After cert issues, set
#   cert_issued=true and re-apply to activate the HTTPS listener and HTTP redirect.
#   User also manually adds an A/CNAME for their domain → alb_dns_name.
# =============================================================================

# Route53 zone lookup — only needed in Route53 mode
data "aws_route53_zone" "main" {
  count        = local.has_route53 ? 1 : 0
  name         = var.domain_name
  private_zone = false
}

# ACM cert — created in both modes whenever domain_name is set
resource "aws_acm_certificate" "main" {
  count                     = local.has_domain ? 1 : 0
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Route53 mode: write validation records automatically
resource "aws_route53_record" "cert_validation" {
  for_each = local.has_route53 ? {
    for dvo in aws_acm_certificate.main[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main[0].zone_id
}

# Route53 mode: wait for cert to issue (records exist, so this completes quickly)
resource "aws_acm_certificate_validation" "main" {
  count                   = local.has_route53 ? 1 : 0
  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# HTTPS listener — created once HTTPS is active (Route53 auto, or external after cert_issued=true)
resource "aws_lb_listener" "https" {
  count             = local.https_active ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  # Route53: use validated cert ARN from the waiter
  # External: cert is already issued by the time cert_issued=true, reference ARN directly
  certificate_arn   = local.has_route53 ? aws_acm_certificate_validation.main[0].certificate_arn : aws_acm_certificate.main[0].arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# Route53 mode: A records for root and www → ALB
resource "aws_route53_record" "app" {
  count   = local.has_route53 ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "app_www" {
  count   = local.has_route53 ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "acm_validation_records" {
  description = "External DNS only: add these CNAMEs at your registrar to validate the ACM cert, then set cert_issued=true and re-apply"
  value = local.has_external ? [
    for dvo in aws_acm_certificate.main[0].domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ] : null
}

output "alb_dns_name" {
  description = "ALB DNS name — point your domain's CNAME here, or use directly for testing"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "ECR repo URL — push images here, then update container_image variable"
  value       = aws_ecr_repository.app.repository_url
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "s3_bucket" {
  value = aws_s3_bucket.assets.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.assets.domain_name
}

output "payload_secret_arn" {
  description = "Secrets Manager ARN for PAYLOAD_SECRET (needed for manual ECS RunTask migrate calls)"
  value       = aws_secretsmanager_secret.payload_secret.arn
}
