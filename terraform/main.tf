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
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
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
  recovery_window_in_days = 0 # allows immediate delete+recreate with the same name
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
  force_destroy = true # allows terraform destroy even when the bucket has objects

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

# CORS so the browser can (a) PUT video parts directly to S3 (multipart upload)
# and (b) let hls.js fetch manifests/segments cross-origin. ETag must be exposed
# for the multipart client to assemble the CompleteMultipartUpload request.
resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = compact([
      local.public_url,
      "http://${aws_lb.main.dns_name}",
      "http://localhost:3000",
    ])
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Managed CloudFront policies for the HLS behavior (cache + CORS passthrough).
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

data "aws_cloudfront_response_headers_policy" "cors" {
  name = "Managed-SimpleCORS"
}

# Origin Access Control — lets CloudFront sign (SigV4) its requests to S3 so the
# bucket can stay fully private (Public Access Block on, no public ACLs). Without
# this the distribution hits the S3 REST endpoint anonymously and every object
# returns 403 AccessDenied — which is exactly what broke HLS playback.
resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "${var.app_name}-assets-oac"
  description                       = "OAC for ${var.app_name} assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "assets" {
  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "S3Assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
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

  # HLS playback: allow OPTIONS (CORS preflight) and forward Origin so hls.js can
  # fetch manifests/segments cross-origin. Long cache — VOD segments are immutable.
  ordered_cache_behavior {
    path_pattern     = "videos/hls/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3Assets"

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors_s3.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.cors.id

    viewer_protocol_policy = "redirect-to-https"
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

# Bucket policy allowing ONLY this CloudFront distribution to read objects.
# Scoped to the service principal + SourceArn condition, so it is not a "public"
# policy and coexists with Public Access Block / BlockPublicPolicy.
data "aws_iam_policy_document" "assets_cloudfront" {
  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.assets.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.assets.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "assets_cloudfront" {
  bucket = aws_s3_bucket.assets.id
  policy = data.aws_iam_policy_document.assets_cloudfront.json
}

# =============================================================================
# ECR — stores versioned app images
# =============================================================================

resource "aws_ecr_repository" "app" {
  name                 = var.app_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true # allows terraform destroy even when images exist

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
    sid = "MediaObjects"
    # AbortMultipartUpload + ListMultipartUploadParts are needed so the app can
    # presign + finalize direct-to-S3 multipart video uploads.
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
    ]
    resources = ["${aws_s3_bucket.assets.arn}/*"]
  }

  statement {
    sid       = "MediaBucketList"
    actions   = ["s3:ListBucket", "s3:ListBucketMultipartUploads"]
    resources = [aws_s3_bucket.assets.arn]
  }

  # Let the app purge the CDN when content changes (Payload afterChange/afterDelete
  # hooks -> CreateInvalidation on the app distribution). Only present when the app
  # CDN exists; the guard keeps the app[0] reference valid when it's disabled.
  dynamic "statement" {
    for_each = local.app_cdn_enabled ? [1] : []
    content {
      sid       = "CloudFrontInvalidate"
      actions   = ["cloudfront:CreateInvalidation"]
      resources = [aws_cloudfront_distribution.app[0].arn]
    }
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
    var.public_url != "" ? var.public_url :
    local.has_domain ? "https://${var.domain_name}" :
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
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "DATABASE_URL", value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}" },
      { name = "S3_BUCKET", value = aws_s3_bucket.assets.id },
      { name = "S3_PREFIX", value = var.s3_prefix },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "PAYLOAD_PUBLIC_SERVER_URL", value = local.public_url },
      # --- Video pipeline ---
      { name = "CLOUDFRONT_DOMAIN", value = aws_cloudfront_distribution.assets.domain_name },
      # App distribution that fronts apex+www; the app issues CloudFront
      # invalidations against it on content change. Empty when the app CDN is off.
      { name = "APP_CLOUDFRONT_DISTRIBUTION_ID", value = try(aws_cloudfront_distribution.app[0].id, "") },
      { name = "VIDEO_SOURCE_PREFIX", value = "videos/source/" },
      { name = "VIDEO_HLS_PREFIX", value = "videos/hls/" },
      # Shared secret the transcode Lambda uses to authenticate its completion
      # webhook. Same value is injected into the Lambda below.
      { name = "WEBHOOK_SECRET", value = random_password.webhook_secret.result },
      # RUN_MIGRATIONS=false: run migrations as a one-off ECS RunTask (off the
      # `builder` image target) before rolling out a new app version, rather than
      # letting N replicas race to migrate the same DB at startup.
      { name = "RUN_MIGRATIONS", value = "false" },
      # HOSTNAME=0.0.0.0: Next.js standalone binds to the system hostname by
      # default (resolves to the container's bridge IP, not loopback), so the
      # health check fetch('http://127.0.0.1:3000/') gets ECONNREFUSED. Forcing
      # 0.0.0.0 makes the server listen on all interfaces including loopback.
      { name = "HOSTNAME", value = "0.0.0.0" }
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
# Migrator task definition
# One-off ECS RunTask run before each deployment that changes the DB schema.
# Uses the :migrator image tag (the builder stage — has full source + payload
# CLI). Runs `payload migrate` via the entrypoint then exits; never kept alive.
# =============================================================================
resource "aws_ecs_task_definition" "migrator" {
  family                   = "${var.app_name}-migrator"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "${var.app_name}-migrator"
    image     = "${aws_ecr_repository.app.repository_url}:migrator"
    essential = true

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "DATABASE_URL", value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}" },
      { name = "RUN_MIGRATIONS", value = "true" },
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
        "awslogs-stream-prefix" = "migrate"
      }
    }
  }])

  tags = { Name = "${var.app_name}-migrator" }
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
  certificate_arn = local.has_route53 ? aws_acm_certificate_validation.main[0].certificate_arn : aws_acm_certificate.main[0].arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# Route53 mode: A records for root and www. Target CloudFront when the app CDN
# is enabled (see cdn_app.tf), otherwise the ALB directly. Flipping
# `enable_app_cdn` swaps these back to the ALB — the rollback path.
resource "aws_route53_record" "app" {
  count   = local.has_route53 ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = local.app_cdn_enabled ? aws_cloudfront_distribution.app[0].domain_name : aws_lb.main.dns_name
    zone_id                = local.app_cdn_enabled ? aws_cloudfront_distribution.app[0].hosted_zone_id : aws_lb.main.zone_id
    evaluate_target_health = local.app_cdn_enabled ? false : true
  }
}

resource "aws_route53_record" "app_www" {
  count   = local.has_route53 ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = local.app_cdn_enabled ? aws_cloudfront_distribution.app[0].domain_name : aws_lb.main.dns_name
    zone_id                = local.app_cdn_enabled ? aws_cloudfront_distribution.app[0].hosted_zone_id : aws_lb.main.zone_id
    evaluate_target_health = local.app_cdn_enabled ? false : true
  }
}

# =============================================================================
# Video pipeline — S3 event → Lambda → MediaConvert (HLS) → webhook
#
# Direct-to-S3 multipart uploads land under videos/source/<id>/. That ObjectCreated
# event triggers the Lambda, which starts a MediaConvert Automated-ABR HLS job
# writing to videos/hls/<id>/. A MediaConvert "Job State Change" event (COMPLETE/
# ERROR) re-invokes the Lambda, which POSTs the app's transcode-callback webhook.
# =============================================================================

# Shared secret between the Lambda and the app webhook.
resource "random_password" "webhook_secret" {
  length  = 48
  special = false
}

# --- MediaConvert service role: lets MediaConvert read the source + write HLS ---
data "aws_iam_policy_document" "mediaconvert_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["mediaconvert.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "mediaconvert" {
  name               = "${var.app_name}-mediaconvert-role"
  assume_role_policy = data.aws_iam_policy_document.mediaconvert_assume.json
  tags               = { Name = "${var.app_name}-mediaconvert-role" }
}

data "aws_iam_policy_document" "mediaconvert" {
  statement {
    sid       = "ReadSourceWriteHls"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.assets.arn}/*"]
  }
  statement {
    sid       = "ListBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.assets.arn]
  }
}

resource "aws_iam_role_policy" "mediaconvert" {
  name   = "${var.app_name}-mediaconvert-policy"
  role   = aws_iam_role.mediaconvert.id
  policy = data.aws_iam_policy_document.mediaconvert.json
}

# --- Lambda execution role ---
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "video_lambda" {
  name               = "${var.app_name}-video-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = { Name = "${var.app_name}-video-lambda-role" }
}

data "aws_iam_policy_document" "video_lambda" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }
  statement {
    sid       = "MediaConvert"
    actions   = ["mediaconvert:CreateJob", "mediaconvert:GetJob", "mediaconvert:DescribeEndpoints"]
    resources = ["*"]
  }
  statement {
    sid       = "PassMediaConvertRole"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.mediaconvert.arn]
  }
  statement {
    sid       = "ReadSource"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.assets.arn}/videos/source/*"]
  }
}

resource "aws_iam_role_policy" "video_lambda" {
  name   = "${var.app_name}-video-lambda-policy"
  role   = aws_iam_role.video_lambda.id
  policy = data.aws_iam_policy_document.video_lambda.json
}

# --- Lambda function (zipped from terraform/lambda/, uses runtime's @aws-sdk) ---
data "archive_file" "video_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/.build/video-lambda.zip"
}

resource "aws_lambda_function" "video_pipeline" {
  function_name    = "${var.app_name}-video-pipeline"
  role             = aws_iam_role.video_lambda.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.video_lambda.output_path
  source_code_hash = data.archive_file.video_lambda.output_base64sha256
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      MEDIACONVERT_ROLE_ARN = aws_iam_role.mediaconvert.arn
      MEDIACONVERT_QUEUE    = "arn:aws:mediaconvert:${var.aws_region}:${data.aws_caller_identity.current.account_id}:queues/Default"
      ASSETS_BUCKET         = aws_s3_bucket.assets.id
      HLS_PREFIX            = "videos/hls/"
      APP_WEBHOOK_URL       = "${local.public_url}/api/videos/transcode-callback"
      WEBHOOK_SECRET        = random_password.webhook_secret.result
    }
  }

  tags = { Name = "${var.app_name}-video-pipeline" }
}

# --- Trigger A: S3 ObjectCreated under videos/source/ ---
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_pipeline.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.assets.arn
}

resource "aws_s3_bucket_notification" "assets" {
  bucket = aws_s3_bucket.assets.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.video_pipeline.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "videos/source/"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

# --- Trigger B: MediaConvert job completion via EventBridge ---
resource "aws_cloudwatch_event_rule" "mediaconvert_complete" {
  name        = "${var.app_name}-mediaconvert-state"
  description = "MediaConvert job COMPLETE/ERROR → video pipeline Lambda"

  event_pattern = jsonencode({
    source        = ["aws.mediaconvert"]
    "detail-type" = ["MediaConvert Job State Change"]
    detail = {
      status = ["COMPLETE", "ERROR"]
    }
  })
}

resource "aws_cloudwatch_event_target" "mediaconvert_complete" {
  rule      = aws_cloudwatch_event_rule.mediaconvert_complete.name
  target_id = "video-pipeline-lambda"
  arn       = aws_lambda_function.video_pipeline.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_pipeline.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.mediaconvert_complete.arn
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

output "migrator_task_definition_family" {
  description = "Migrator task definition family name — use with aws ecs run-task --task-definition"
  value       = aws_ecs_task_definition.migrator.family
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

output "mediaconvert_role_arn" {
  description = "MediaConvert service role ARN used by the transcode Lambda"
  value       = aws_iam_role.mediaconvert.arn
}

output "video_pipeline_lambda" {
  description = "Name of the video transcode Lambda (for log tailing / redeploys)"
  value       = aws_lambda_function.video_pipeline.function_name
}

output "webhook_secret" {
  description = "Shared secret for the transcode completion webhook"
  value       = random_password.webhook_secret.result
  sensitive   = true
}

output "payload_secret_arn" {
  description = "Secrets Manager ARN for PAYLOAD_SECRET (needed for manual ECS RunTask migrate calls)"
  value       = aws_secretsmanager_secret.payload_secret.arn
}

output "app_name" {
  value = var.app_name
}

output "public_subnet_1_id" {
  value = aws_subnet.public_1.id
}

output "public_subnet_2_id" {
  value = aws_subnet.public_2.id
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "aws_region" {
  description = "AWS region the stack is deployed in (consumed by scripts/deploy.sh)"
  value       = var.aws_region
}
