# AWS Operations & Troubleshooting Quick Ref

## Daily Monitoring

### Check instance health
```bash
# SSH in
APP_IP=$(terraform -chdir=terraform output -raw app_public_ip)
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP

# Check PM2 status
pm2 status
pm2 logs portfolio

# Check disk space
df -h

# Check system load
top
```

### View CloudWatch metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --dimensions Name=InstanceId,Value=i-xxxxxxxxx
```

### Database backups
```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier portfolio-db \
  --db-snapshot-identifier portfolio-backup-$(date +%Y%m%d-%H%M%S)

# List backups
aws rds describe-db-snapshots \
  --db-instance-identifier portfolio-db

# Restore from snapshot (when needed)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier portfolio-db-restored \
  --db-snapshot-identifier <snapshot-id>
```

---

## Code Deployment

### Automated deployment flow
```bash
# 1. Commit code locally
git add .
git commit -m "Update portfolio"
git push origin main

# 2. SSH to instance
APP_IP=$(terraform -chdir=terraform output -raw app_public_ip)
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP

# 3. Pull and rebuild
cd /var/www/portfolio
git pull origin main
npm install
npm run build

# 4. Restart PM2
pm2 restart portfolio
pm2 save

# 5. Verify
curl http://localhost:3000
```

### One-liner deployment
```bash
#!/bin/bash
APP_IP=$(terraform -chdir=terraform output -raw app_public_ip)
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP << 'EOF'
cd /var/www/portfolio && \
git pull origin main && \
npm install && \
npm run build && \
pm2 restart portfolio && \
echo "✓ Deployed"
EOF
```

---

## Troubleshooting

### App won't start
```bash
# Check error logs
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP
pm2 logs portfolio --lines 50

# Check environment variables
cat .env

# Verify database connection
psql -h <db-endpoint> -U payloadadmin -d payload_db -c "SELECT 1;"

# Restart
pm2 restart portfolio
```

### Database connection refused
```bash
# Check RDS security group
aws ec2 describe-security-groups \
  --group-ids <db-sg-id> \
  --query 'SecurityGroups[0].IpPermissions'

# EC2 must be allowed to reach RDS:5432
# If not, authorize:
aws ec2 authorize-security-group-ingress \
  --group-id <db-sg-id> \
  --protocol tcp --port 5432 \
  --source-group <app-sg-id>

# Test from EC2:
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP
nc -zv <db-endpoint> 5432
```

### Can't SSH to instance
```bash
# Check security group allows port 22
aws ec2 describe-security-groups --group-ids <sg-id>

# If not, add it:
aws ec2 authorize-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp --port 22 \
  --cidr 0.0.0.0/0

# Try SSH with verbose output
ssh -vvv -i ~/.ssh/id_rsa ubuntu@$APP_IP
```

### Out of disk space
```bash
# Check usage
df -h

# Clean up Node modules cache
cd /var/www/portfolio
npm cache clean --force

# Check log files
du -sh /var/log/*
sudo journalctl --vacuum=100M

# If still full, scale up storage:
# Edit terraform and increase allocated_storage
```

### High CPU/memory usage
```bash
# Check what's eating resources
top -b -n 1 | head -20

# Kill runaway process
kill -9 <pid>

# Check for memory leaks in app
pm2 monit

# Scale instance type in Terraform
# Change instance_type = "t3.small" in variables.tf
terraform -chdir=terraform plan
terraform -chdir=terraform apply
```

---

## Cost Optimization

### Estimate monthly costs
```bash
# EC2 on-demand
# t3.micro: $0.0104/hour = ~$7.50/month

# RDS on-demand
# db.t3.micro: ~$15/month

# S3 + CloudFront
# Minimal portfolio: ~$5/month

# Total: ~$28/month if always running
```

### Reduce costs

#### Option 1: Stop instance when not in use
```bash
# Stop (not terminate)
aws ec2 stop-instances --instance-ids <instance-id>

# Start again
aws ec2 start-instances --instance-ids <instance-id>
# (Saves cost, but IP changes unless you use Elastic IP)
```

#### Option 2: Use Elastic IP to keep same IP
```bash
# Allocate Elastic IP
aws ec2 allocate-address --domain vpc

# Associate with instance
aws ec2 associate-address \
  --instance-id <instance-id> \
  --allocation-id <allocation-id>
```

#### Option 3: Use spot instances (cheaper, can be interrupted)
```hcl
# In terraform/main.tf
resource "aws_instance" "app" {
  # ... existing config ...
  instance_market_options {
    market_type = "spot"
    spot_options {
      max_price = "0.015"  # Max $0.015/hour
    }
  }
}
```

#### Option 4: Reserved instances for long-term
```bash
# Buy 1-year reserved instance = ~30% discount
aws ec2 purchase-reserved-instances-offering \
  --reserved-instances-offering-id <offering-id>
```

---

## Scaling (when traffic grows)

### Upgrade instance type
```bash
# Stop instance
aws ec2 stop-instances --instance-ids <instance-id>

# Change type in Terraform
# instance_type = "t3.small"  (or larger)

terraform -chdir=terraform apply

# Start instance
aws ec2 start-instances --instance-ids <instance-id>
```

### Add autoscaling
```hcl
# In terraform/main.tf
resource "aws_launch_template" "app" {
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  user_data     = base64encode(templatefile(...))
}

resource "aws_autoscaling_group" "app" {
  name                = "portfolio-asg"
  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }
  min_size            = 1
  max_size            = 3
  desired_capacity    = 1
  vpc_zone_identifier = [aws_subnet.public_1.id, aws_subnet.public_2.id]
  health_check_type   = "ELB"
  health_check_grace_period = 300
}

resource "aws_lb" "app" {
  name               = "portfolio-lb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

resource "aws_lb_target_group" "app" {
  name     = "portfolio-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
}

resource "aws_autoscaling_group_attachment" "app" {
  autoscaling_group_name = aws_autoscaling_group.app.name
  lb_target_group_arn    = aws_lb_target_group.app.arn
}
```

### Add CloudFlare in front for caching
```bash
# Update domain DNS to CloudFlare instead of direct EC2 IP
# CloudFlare will cache static assets, reduce origin requests
```

---

## Disaster Recovery

### Backup everything regularly
```bash
# Automated backup script
cat > backup.sh << 'BACKUP'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)

# Backup database
aws rds create-db-snapshot \
  --db-instance-identifier portfolio-db \
  --db-snapshot-identifier portfolio-db-$DATE

# Backup S3
aws s3 sync s3://portfolio-assets ./backups/s3-$DATE/

# Backup code
cd /var/www/portfolio
git bundle create ./backups/portfolio-$DATE.bundle --all

echo "Backup complete: $DATE"
BACKUP

chmod +x backup.sh
# Run with cron: 0 2 * * * /home/ubuntu/backup.sh
```

### Restore from backup
```bash
# Restore database from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier portfolio-db-restored \
  --db-snapshot-identifier portfolio-db-20240115-120000

# Update connection string in app
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP
# Edit .env with new RDS endpoint
```

---

## Monitoring & Alerts

### Create CloudWatch alarm (high CPU)
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name portfolio-high-cpu \
  --alarm-description "Alert when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Create alarm for RDS
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name portfolio-db-cpu \
  --alarm-description "Alert when DB CPU > 85%" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=DBInstanceIdentifier,Value=portfolio-db
```

### Send alerts to email
```bash
# Create SNS topic
aws sns create-topic --name portfolio-alerts

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789:portfolio-alerts \
  --protocol email \
  --notification-endpoint your@email.com

# Attach to alarm
aws cloudwatch put-metric-alarm \
  --alarm-name portfolio-high-cpu \
  --alarm-actions arn:aws:sns:us-east-1:123456789:portfolio-alerts
```

---

## Security

### Update security patches
```bash
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP
sudo apt-get update && sudo apt-get upgrade -y
```

### Rotate database password
```bash
aws rds modify-db-instance \
  --db-instance-identifier portfolio-db \
  --master-user-password new_secure_password_here \
  --apply-immediately

# Update .env
ssh -i ~/.ssh/id_rsa ubuntu@$APP_IP
# Edit .env with new password
pm2 restart portfolio
```

### Restrict SSH access to your IP only
```bash
# Find your current IP
curl ifconfig.me

# Update security group
aws ec2 revoke-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp --port 22 \
  --cidr YOUR.IP.ADDRESS/32
```

---

## Cleanup & Destruction

### Destroy everything when done
```bash
# From project root
cd terraform

# See what will be deleted
terraform plan -destroy

# Delete all resources
terraform destroy -var="db_password=anything"

# This will:
# - Terminate EC2 instance
# - Delete RDS database (skip_final_snapshot = true)
# - Delete VPC and subnets
# - Delete S3 bucket and CloudFront
# - Remove security groups
```

### Keep data but stop costs
```bash
# Stop instance (doesn't delete it)
aws ec2 stop-instances --instance-ids <instance-id>

# Cost drops to ~$1/month for stopped instance

# Start again later
aws ec2 start-instances --instance-ids <instance-id>
```
