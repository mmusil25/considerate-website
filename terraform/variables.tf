variable "aws_region" {
  default = "us-east-2"
}

variable "app_name" {
  default = "portfolio"
}

variable "environment" {
  default = "prod"
}

variable "instance_type" {
  default = "t3.small"
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

variable "github_repo" {
  default = "https://github.com/mmusil25/considerate-website.git"
}

# Per-site prefix inside the shared media bucket (e.g. "markmusil/"). Lets many
# sites share one bucket without colliding. Empty = bucket root (single site).
variable "s3_prefix" {
  default = ""
}
