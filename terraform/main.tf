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

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = {
    Name = "${var.app_name}-vpc"
  }
}

# Public Subnets
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

# Private Subnets (for RDS)
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
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.main.id
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

# Fetch available AZs
data "aws_availability_zones" "available" {
  state = "available"
}

# Security Groups
resource "aws_security_group" "app" {
  name   = "${var.app_name}-app-sg"
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

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
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
    Name = "${var.app_name}-app-sg"
  }
}

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

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "main" {
  identifier              = "${var.app_name}-db"
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  db_name                 = var.db_name
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  skip_final_snapshot     = true
  publicly_accessible     = false

  tags = {
    Name = "${var.app_name}-db"
  }
}

# --- Stable PAYLOAD_SECRET (PROPOSED_APP_CHANGES.md #2) ----------------------
# The secret must be IDENTICAL across every boot/container of a site, or admin
# sessions are invalidated and encrypted fields become undecryptable. We
# generate it ONCE and persist it in Secrets Manager; init.sh fetches it at boot
# instead of running `openssl rand` every time.
#
# `random_password` is generated once and stored in Terraform state, so repeat
# `apply`s keep the same value (it only changes if you taint/replace it).
resource "random_password" "payload_secret" {
  length  = 48
  special = false # keep it shell/.env-safe (alphanumeric) — no quoting needed
}

resource "aws_secretsmanager_secret" "payload_secret" {
  name        = "${var.app_name}/payload-secret"
  description = "Stable PAYLOAD_SECRET for ${var.app_name}. Do NOT rotate without planning: rotating invalidates sessions and breaks encrypted fields."
}

resource "aws_secretsmanager_secret_version" "payload_secret" {
  secret_id     = aws_secretsmanager_secret.payload_secret.id
  secret_string = random_password.payload_secret.result
}

# --- IAM role for the app instance -------------------------------------------
# The instance had NO role before. The S3 media plugin (PROPOSED_APP_CHANGES.md
# #1) needs to read/write the bucket, and boot needs to read the secret above.
# Prefer this instance role over static keys baked into env.
data "aws_iam_policy_document" "app_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.app_name}-app-role"
  assume_role_policy = data.aws_iam_policy_document.app_assume.json

  tags = {
    Name = "${var.app_name}-app-role"
  }
}

data "aws_iam_policy_document" "app" {
  # Read/write/delete media objects under this site's prefix.
  statement {
    sid       = "MediaObjects"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.assets.arn}/*"]
  }

  # List is needed for some upload/list operations.
  statement {
    sid       = "MediaBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.assets.arn]
  }

  # Read the stable PAYLOAD_SECRET at boot.
  statement {
    sid       = "ReadPayloadSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.payload_secret.arn]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "${var.app_name}-app-policy"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.app_name}-app-profile"
  role = aws_iam_role.app.name
}

# EC2 Instance for App
resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.app.id]
  key_name               = aws_key_pair.deployer.key_name
  iam_instance_profile   = aws_iam_instance_profile.app.name

  user_data = base64encode(templatefile("${path.module}/init.sh", {
    db_host     = aws_db_instance.main.endpoint
    db_name     = var.db_name
    db_user     = var.db_username
    db_password = var.db_password
    aws_region  = var.aws_region
    s3_bucket   = aws_s3_bucket.assets.id
    s3_prefix   = var.s3_prefix
    secret_arn  = aws_secretsmanager_secret.payload_secret.arn
  }))

  tags = {
    Name = "${var.app_name}-app"
  }

  depends_on = [aws_db_instance.main, aws_secretsmanager_secret_version.payload_secret]
}

# Find latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# EC2 Key Pair (replace with your own public key)
resource "aws_key_pair" "deployer" {
  key_name   = "${var.app_name}-deployer"
  public_key = file("~/.ssh/id_rsa.pub") # Use your SSH public key
}

# S3 Bucket for Assets
resource "aws_s3_bucket" "assets" {
  bucket = "${var.app_name}-assets-${data.aws_caller_identity.current.account_id}"

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

# CloudFront Distribution
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

# Outputs
data "aws_caller_identity" "current" {}

output "app_public_ip" {
  value = aws_instance.app.public_ip
}

output "app_public_dns" {
  value = aws_instance.app.public_dns
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

output "ssh_command" {
  value = "ssh -i ~/.ssh/id_rsa ubuntu@${aws_instance.app.public_ip}"
}