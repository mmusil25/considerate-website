variable "aws_region" {
  default = "us-east-2"
}

variable "app_name" {
  default = "portfolio"
}

variable "environment" {
  default = "prod"
}

variable "db_instance_class" {
  default = "db.t3.micro"
}

variable "db_name" {
  default = "payload_db"
}

variable "db_username" {
  default = "mark"
}

variable "db_password" {
  sensitive = true
}

# Per-site prefix inside the shared media bucket (e.g. "markmusil/"). Lets many
# sites share one bucket without colliding. Empty = bucket root (single site).
variable "s3_prefix" {
  default = ""
}

# --- Fargate / ECS -----------------------------------------------------------

# ECR image URI to deploy, e.g.:
#   <account>.dkr.ecr.us-east-2.amazonaws.com/portfolio:<git-sha>
# This must be set on first apply. Subsequent image updates = update this var
# and re-apply; ECS does a rolling replacement automatically.
variable "container_image" {
  description = "ECR image URI for the app container (required)"
}

# Fargate CPU/memory. Valid combinations:
#   256 / 512   (0.25 vCPU / 512 MB)
#   512 / 1024  (0.5  vCPU / 1 GB)  ← default, enough for a single Next/Payload site
#   1024 / 2048 (1    vCPU / 2 GB)
variable "task_cpu" {
  default = "512"
}

variable "task_memory" {
  default = "1024"
}

# Number of running task replicas. 1 = simple/cheap; raise for HA.
variable "desired_count" {
  default = 1
}

# Your domain name (e.g. "example.com"). Triggers ACM cert + HTTPS listener.
# Leave empty to use the ALB DNS name only (no HTTPS).
variable "domain_name" {
  description = "Domain name for the site. Leave empty to skip HTTPS/DNS setup."
  default     = ""
}

# true  → domain is managed in Route53; Terraform handles cert validation,
#         HTTPS listener, and A records automatically.
# false → domain is at an external registrar; Terraform creates the cert and
#         outputs validation CNAMEs for you to add manually. Set cert_issued=true
#         and re-apply once the cert issues to activate HTTPS.
variable "use_route53" {
  description = "Whether the domain is managed in Route53 (true) or an external registrar (false)."
  default     = true
}

# External DNS only. Flip to true after adding the acm_validation_records CNAMEs
# at your registrar and the cert has issued, then re-run terraform apply.
variable "cert_issued" {
  description = "External DNS only: set true after ACM cert validates to activate the HTTPS listener."
  default     = false
}

# Overrides the public URL injected into Payload. Auto-derived from domain_name
# or ALB DNS — only set this if you need something non-standard.
variable "public_url" {
  description = "Public URL for the site. Auto-derived from domain_name or ALB DNS if left empty."
  default     = ""
}
