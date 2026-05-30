# =============================================================================
# Copy this file to terraform.tfvars and fill in your values.
# terraform.tfvars is gitignored; this file is not.
# =============================================================================

# --- Required ----------------------------------------------------------------

app_name    = "my-site"                    # prefix for all AWS resource names
db_password = "choose-a-strong-password"

# --- Domain / HTTPS ----------------------------------------------------------
# Set domain_name to your domain, then pick one of the two modes below.

domain_name = "example.com"

# Route53 mode (default): domain was purchased in / transferred to Route53.
# Terraform creates the ACM cert, validates it, wires HTTPS, and creates DNS
# records automatically.
use_route53 = true

# External DNS mode: domain lives at an external registrar (Cloudflare, etc.).
# Set use_route53 = false. After terraform apply, note the acm_validation_records
# output, add those CNAMEs at your registrar, then set cert_issued = true and
# re-run terraform apply to activate HTTPS. Your domain A/CNAME must also point
# to the alb_dns_name output.
# use_route53  = false
# cert_issued  = false   # flip to true after cert validates, then re-apply

# --- Image (fill in after step 3 of the standup guide) -----------------------

container_image = "placeholder"   # replace with full ECR URI

# --- Optional (defaults shown) -----------------------------------------------

# aws_region        = "us-east-2"
# db_instance_class = "db.t3.micro"
# task_cpu          = "512"
# task_memory       = "1024"
# desired_count     = 1
