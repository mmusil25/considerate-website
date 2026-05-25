# AWS + Payload CMS + Builder.io Deployment Guide

Full infrastructure-as-code setup using Terraform. Everything via CLI.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Builder.io UI Layer               │
│              (Static hosting + CDN)                  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│        Next.js Frontend (on EC2 or ECS)              │
│         + Payload CMS Admin Dashboard               │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│     Payload CMS API (Node.js on EC2/ECS)            │
│            Database: RDS PostgreSQL                 │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│         S3 + CloudFront (Asset Storage)             │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

```bash
# Install required CLI tools
brew install terraform awscli node

# Configure AWS credentials
aws configure
# Paste your Access Key ID and Secret Access Key

# Verify setup
terraform --version
aws sts get-caller-identity
```

---

## Step 1: Create Project Structure

```bash
mkdir -p portfolio-infra/{terraform,app,builder-io}
cd portfolio-infra

# Initialize git (optional but recommended)
git init
echo "*.tfstate*" >> .gitignore
echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
```

---

## Step 2: Create Terraform Configuration

### `terraform/variables.tf`

```hcl
variable "aws_region" {
  default = "us-east-1"
}

variable "app_name" {
  default = "portfolio"
}

variable "environment" {
  default = "prod"
}

variable "instance_type" {
  default = "t3.micro"
}

variable "db_instance_class" {
  default = "db.t3.micro"
}

variable "db_name" {
  default = "payload_db"
}

variable "db_username" {
  default = "payloadadmin"
}

variable "db_password" {
  sensitive = true
  # Use: terraform apply -var="db_password=your_secure_password"
}

variable "github_repo" {
  # Your portfolio repo for auto-deploy
  default = ""
}
```

### `terraform/main.tf`

```hcl
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
  engine_version          = "15.3"
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

# EC2 Instance for App
resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.app.id]
  key_name               = aws_key_pair.deployer.key_name

  user_data = base64encode(templatefile("${path.module}/init.sh", {
    db_host     = aws_db_instance.main.endpoint
    db_name     = var.db_name
    db_user     = var.db_username
    db_password = var.db_password
  }))

  tags = {
    Name = "${var.app_name}-app"
  }

  depends_on = [aws_db_instance.main]
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
```

### `terraform/init.sh`

```bash
#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y curl git node npm

# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 18

# Install pm2 for process management
npm install -g pm2

# Create app directory
mkdir -p /var/www/portfolio
cd /var/www/portfolio

# Set environment variables
cat > .env << EOF
DATABASE_URI=postgresql://${db_user}:${db_password}@${db_host}:5432/${db_name}
NODE_ENV=production
PAYLOAD_SECRET=$(openssl rand -base64 32)
NEXT_PUBLIC_API_URL=http://localhost:3000
EOF

# Clone your repo or initialize project
# (replace with your actual repo)
git clone https://github.com/YOUR_USERNAME/portfolio.git .

# Install dependencies
npm install

# Build
npm run build

# Start with PM2
pm2 start npm --name "portfolio" -- start
pm2 startup
pm2 save
```

---

## Step 3: Deploy Infrastructure

```bash
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var="db_password=YourSecurePassword123!" -out=tfplan

# Apply
terraform apply tfplan

# Save outputs
terraform output -json > ../outputs.json
```

Grab these outputs:
```bash
APP_IP=$(terraform output -raw app_public_ip)
APP_DNS=$(terraform output -raw app_public_dns)
SSH_CMD=$(terraform output -raw ssh_command)

echo $SSH_CMD  # Use this to SSH into your instance
```

---

## Step 4: Set Up Payload CMS Locally (then deploy)

```bash
cd ../app

# Create Next.js + Payload template
npx create-payload-app@latest . --template next

# Or initialize manually:
npm init -y
npm install payload express next react
```

### Example `src/collections/Projects.ts`

```typescript
import { CollectionConfig } from 'payload/types';

const Projects: CollectionConfig = {
  slug: 'projects',
  auth: false,
  access: {
    read: async () => true,
    create: async ({ req }) => req.user ? true : false,
    update: async ({ req }) => req.user ? true : false,
    delete: async ({ req }) => req.user ? true : false,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'technologies',
      type: 'array',
      fields: [
        { name: 'tech', type: 'text' },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
    },
  ],
};

export default Projects;
```

### Deploy to EC2

```bash
# From your local machine
APP_IP=$(cat ../outputs.json | jq -r .app_public_ip.value)

# SCP your app code
scp -i ~/.ssh/id_rsa -r . ubuntu@$APP_IP:/var/www/portfolio/

# SSH in and restart
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP << 'EOF'
cd /var/www/portfolio
npm install
npm run build
pm2 restart portfolio
EOF
```

---

## Step 5: Configure Builder.io

### Create Builder.io Account

1. Sign up at [builder.io](https://builder.io)
2. Create a new space
3. Generate API key from settings

### Connect Payload API to Builder

In Builder.io, create a custom integration:

```bash
POST https://cdn.builder.io/api/v1/integrations

{
  "name": "Payload CMS",
  "baseUrl": "http://$APP_IP:3000",
  "authorizationType": "custom",
  "actions": [
    {
      "name": "getProjects",
      "url": "/api/projects"
    },
    {
      "name": "getProject",
      "url": "/api/projects/:id"
    }
  ]
}
```

### Build Pages in Builder

1. Create a new page in Builder.io
2. Add Payload data bindings:
   ```
   {{ getProjects().data }}
   ```
3. Design responsively
4. Publish

### Render Builder Pages in Next.js

```typescript
// app/pages/[...slug].tsx
import { BuilderComponent, builder } from '@builder.io/react';

builder.init('YOUR_BUILDER_API_KEY');

export default function Page({ builderJson }) {
  return <BuilderComponent model="page" content={builderJson} />;
}

export async function getStaticProps({ params }) {
  const page = await builder
    .get('page', {
      userAttributes: {
        urlPath: `/${params.slug.join('/')}`,
      },
    })
    .toPromise();

  return {
    props: { builderJson: page },
    revalidate: 60,
  };
}
```

---

## Step 6: Custom Domain & SSL

### Buy Domain & Point to CloudFront

```bash
# Get your CloudFront domain
CLOUDFRONT=$(terraform output -raw cloudfront_domain)

# In your DNS provider (Route53, Namecheap, etc.):
# Create CNAME: yourdomain.com -> $CLOUDFRONT
```

### SSL Certificate (AWS Certificate Manager)

```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

Then update CloudFront to use the certificate.

---

## Step 7: Monitoring & Cost Optimization

### CloudWatch Monitoring

```bash
# View EC2 metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=$(terraform output -raw app_public_ip | cut -d. -f1-3).* \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average
```

### Auto Scaling (Optional, when traffic grows)

```hcl
# In terraform/main.tf
resource "aws_launch_template" "app" {
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  user_data     = base64encode(...)
}

resource "aws_autoscaling_group" "app" {
  launch_template {
    id = aws_launch_template.app.id
  }
  min_size         = 1
  max_size         = 3
  desired_capacity = 1
  vpc_zone_identifier = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}
```

---

## Step 8: Maintenance & Updates

### Backup Database

```bash
aws rds create-db-snapshot \
  --db-instance-identifier portfolio-db \
  --db-snapshot-identifier portfolio-db-$(date +%Y%m%d)
```

### Update App Code

```bash
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP << 'EOF'
cd /var/www/portfolio
git pull origin main
npm install
npm run build
pm2 restart portfolio
EOF
```

### Destroy Everything (when done learning)

```bash
cd terraform
terraform destroy -var="db_password=YourSecurePassword123!"
```

---

## Cost Estimate (US East 1, 12 months)

- **EC2 t3.micro**: ~$8/month
- **RDS db.t3.micro**: ~$15/month
- **S3 + CloudFront**: ~$5/month (minimal traffic)
- **Data Transfer**: Minimal for portfolio
- **Total**: ~$30/month = **$360/year**

(Vercel would be similar for a portfolio, but scales linearly. AWS becomes cheaper as traffic grows.)

---

## Troubleshooting

### Can't SSH?
```bash
# Check security group
aws ec2 describe-security-groups --group-ids <sg-id>

# Update inbound rule if needed
aws ec2 authorize-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp --port 22 --cidr 0.0.0.0/0
```

### App not starting?
```bash
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP
pm2 logs portfolio
```

### Database connection error?
```bash
# Check security group allows EC2 to reach RDS
aws ec2 describe-security-groups --group-ids <db-sg-id>

# Test connection
psql -h <db-endpoint> -U payloadadmin -d payload_db
```

---

## Next Steps

1. **Builder.io Pages**: Design 5-10 portfolio pieces
2. **SEO**: Add meta tags, OpenGraph
3. **Analytics**: Integrate Plausible or Fathom (privacy-focused)
4. **Performance**: Enable caching headers in CloudFront
5. **Automation**: GitHub Actions → deploy on push

---

**Questions?** All infrastructure is version-controlled in `terraform/` — commit and iterate.
