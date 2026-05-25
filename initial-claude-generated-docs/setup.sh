#!/bin/bash
# Quick-start script for Payload + AWS deployment
# Usage: bash setup.sh <aws-region> <app-name> <db-password>

set -e

AWS_REGION=${1:-us-east-1}
APP_NAME=${2:-portfolio}
DB_PASSWORD=${3:-$(openssl rand -base64 32)}

echo "==================================="
echo "Payload CMS + AWS Setup"
echo "==================================="
echo "Region: $AWS_REGION"
echo "App: $APP_NAME"
echo ""

# Check dependencies
echo "[1/7] Checking dependencies..."
for cmd in terraform aws node npm git; do
  if ! command -v $cmd &> /dev/null; then
    echo "❌ $cmd not found. Install with: brew install $cmd"
    exit 1
  fi
done
echo "✓ All dependencies installed"

# Create project structure
echo "[2/7] Creating project structure..."
mkdir -p {terraform,app,builder-io}
cd terraform

# Generate SSH key if not present
echo "[3/7] Checking SSH key..."
if [ ! -f ~/.ssh/id_rsa.pub ]; then
  echo "Generating SSH key..."
  ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa -C "$USER@$HOSTNAME"
fi
echo "✓ SSH key ready"

# Create terraform files
echo "[4/7] Creating Terraform configuration..."

# variables.tf
cat > variables.tf << 'EOF'
variable "aws_region" {
  default = "us-east-1"
}

variable "app_name" {
  default = "portfolio"
}

variable "instance_type" {
  default = "t3.micro"
}

variable "db_instance_class" {
  default = "db.t3.micro"
}

variable "db_password" {
  sensitive = true
}
EOF

# Download main.tf from our template (simplified)
cat > main.tf << 'EOF'
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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
}

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[0]
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[1]
}

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.main.id
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

# Security Groups
resource "aws_security_group" "app" {
  name   = "portfolio-app-sg"
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
}

resource "aws_security_group" "db" {
  name   = "portfolio-db-sg"
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
}

# RDS
resource "aws_db_subnet_group" "main" {
  name       = "portfolio-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_db_instance" "main" {
  identifier              = "portfolio-db"
  engine                  = "postgres"
  engine_version          = "15.3"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  db_name                 = "payload_db"
  username                = "payloadadmin"
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  skip_final_snapshot     = true
  publicly_accessible     = false
}

# EC2 Key Pair
resource "aws_key_pair" "deployer" {
  key_name   = "portfolio-deployer"
  public_key = file("~/.ssh/id_rsa.pub")
}

# EC2 Instance
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.app.id]
  key_name               = aws_key_pair.deployer.key_name

  user_data = base64encode(templatefile("${path.module}/init.sh", {
    db_host     = aws_db_instance.main.endpoint
    db_name     = "payload_db"
    db_user     = "payloadadmin"
    db_password = var.db_password
  }))

  depends_on = [aws_db_instance.main]

  tags = {
    Name = "portfolio-app"
  }
}

# S3
resource "aws_s3_bucket" "assets" {
  bucket = "portfolio-assets-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

# CloudFront
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
EOF

# init.sh
cat > init.sh << 'EOF'
#!/bin/bash
set -e

apt-get update
apt-get install -y curl git build-essential

curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

npm install -g pm2

mkdir -p /var/www/portfolio
cd /var/www/portfolio

cat > .env << DOTENV
DATABASE_URI=postgresql://${db_user}:${db_password}@${db_host}:5432/${db_name}
NODE_ENV=production
PAYLOAD_SECRET=$(openssl rand -base64 32)
NEXT_PUBLIC_API_URL=http://localhost:3000
DOTENV

npm init -y
npm install payload express next react

echo "Payload initialized. Deploy your code with: scp -r . ubuntu@\$IP:/var/www/portfolio/"
EOF

chmod +x init.sh

echo "✓ Terraform files created"

# Initialize terraform
echo "[5/7] Initializing Terraform..."
terraform init

# Plan
echo "[6/7] Planning deployment..."
terraform plan -var="db_password=$DB_PASSWORD" -out=tfplan

# Ask for confirmation
echo ""
echo "==================================="
echo "Ready to deploy!"
echo "==================================="
echo "This will create:"
echo "  - VPC with public/private subnets"
echo "  - RDS PostgreSQL database"
echo "  - EC2 instance (t3.micro)"
echo "  - S3 bucket + CloudFront"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Apply
echo "[7/7] Deploying infrastructure..."
terraform apply tfplan

echo ""
echo "==================================="
echo "✓ Deployment complete!"
echo "==================================="
terraform output

APP_IP=$(terraform output -raw app_public_ip)
cat > ../DEPLOYMENT_INFO.txt << EOF
=== DEPLOYMENT INFO ===
SSH: ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP
App IP: $APP_IP

To deploy your app:
  scp -i ~/.ssh/id_rsa -r . ubuntu@$APP_IP:/var/www/portfolio/
  ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP "cd /var/www/portfolio && npm install && npm run build && pm2 restart portfolio"

Save this for later: $DB_PASSWORD
EOF

cat ../DEPLOYMENT_INFO.txt
