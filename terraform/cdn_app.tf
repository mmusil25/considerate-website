# =============================================================================
# CloudFront in front of the APP (apex + www)
#
# Goal: cheapest-to-host AND fastest-per-page. CloudFront caches pages (ISR),
# /_next/static (immutable), and /_next/image variants at the edge, so most
# requests never touch the Fargate container — that offloads the expensive
# always-on compute and rides AWS's perpetual CloudFront free tier.
#
# Three wiring facts make this work:
#  1. CloudFront viewer certs MUST live in us-east-1, regardless of the app's
#     region — hence the aliased provider + a second ACM cert below.
#  2. CloudFront can't speak HTTPS to the ALB by its raw *.elb.amazonaws.com name
#     (cert SNI mismatch -> 502). So we publish a dedicated `origin.<domain>`
#     hostname, attach a matching cert to the ALB as an SNI cert, and point the
#     origin there — keeping the CloudFront->ALB hop encrypted (admin logins!).
#  3. Pages must send a CDN-cacheable Cache-Control. The app change from
#     `force-dynamic` to ISR (`revalidate`) does that; the page cache policy here
#     honors the origin's s-maxage.
#
# Flip `enable_app_cdn = false` to instantly route DNS back to the ALB (the A
# records below switch targets), which is the escape hatch if anything misfires.
# =============================================================================

variable "enable_app_cdn" {
  description = "Put CloudFront in front of the app (apex + www). Requires use_route53=true."
  type        = bool
  default     = true
}

locals {
  app_cdn_enabled = local.has_route53 && var.enable_app_cdn
  origin_host     = "origin.${var.domain_name}"
}

# CloudFront viewer certs must be in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ---------------------------------------------------------------------------
# Cert #1 (us-east-1): the cert CloudFront presents to viewers for apex + www.
# ---------------------------------------------------------------------------
resource "aws_acm_certificate" "cdn" {
  count    = local.app_cdn_enabled ? 1 : 0
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Cert #2 (app region): for `origin.<domain>`, attached to the ALB as an SNI
# cert so CloudFront can reach the ALB over HTTPS with a matching certificate.
# The ALB's existing default cert (apex + www) is left untouched.
# ---------------------------------------------------------------------------
resource "aws_acm_certificate" "origin" {
  count = local.app_cdn_enabled ? 1 : 0

  domain_name       = local.origin_host
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records for both certs. `allow_overwrite` because the CDN cert's
# apex/www validation CNAMEs can collide with the ALB cert's identical tokens
# (ACM reuses validation tokens per domain within an account).
resource "aws_route53_record" "cdn_cert_validation" {
  for_each = local.app_cdn_enabled ? {
    for dvo in aws_acm_certificate.cdn[0].domain_validation_options : dvo.domain_name => {
      name = dvo.resource_record_name, record = dvo.resource_record_value, type = dvo.resource_record_type
    }
  } : {}

  zone_id         = data.aws_route53_zone.main[0].zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_route53_record" "origin_cert_validation" {
  for_each = local.app_cdn_enabled ? {
    for dvo in aws_acm_certificate.origin[0].domain_validation_options : dvo.domain_name => {
      name = dvo.resource_record_name, record = dvo.resource_record_value, type = dvo.resource_record_type
    }
  } : {}

  zone_id         = data.aws_route53_zone.main[0].zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "cdn" {
  count                   = local.app_cdn_enabled ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cdn[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cdn_cert_validation : r.fqdn]
}

resource "aws_acm_certificate_validation" "origin" {
  count                   = local.app_cdn_enabled ? 1 : 0
  certificate_arn         = aws_acm_certificate.origin[0].arn
  validation_record_fqdns = [for r in aws_route53_record.origin_cert_validation : r.fqdn]
}

# Attach the origin cert to the existing ALB HTTPS listener as an SNI cert, and
# publish origin.<domain> -> ALB so CloudFront's HTTPS origin handshake matches.
resource "aws_lb_listener_certificate" "origin" {
  count           = local.app_cdn_enabled ? 1 : 0
  listener_arn    = aws_lb_listener.https[0].arn
  certificate_arn = aws_acm_certificate_validation.origin[0].certificate_arn
}

resource "aws_route53_record" "origin" {
  count   = local.app_cdn_enabled ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = local.origin_host
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ---------------------------------------------------------------------------
# Cache policies
# ---------------------------------------------------------------------------
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# /_next/image: variants differ by url/w/q AND by Accept (avif vs webp vs jpeg),
# so all four belong in the cache key. Long TTLs — variants are immutable.
resource "aws_cloudfront_cache_policy" "next_image" {
  count       = local.app_cdn_enabled ? 1 : 0
  name        = "${var.app_name}-next-image"
  min_ttl     = 0
  default_ttl = 31536000
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
    cookies_config { cookie_behavior = "none" }
    headers_config {
      header_behavior = "whitelist"
      headers { items = ["Accept"] }
    }
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings { items = ["url", "w", "q"] }
    }
  }
}

# Pages: honor the origin's Cache-Control (ISR s-maxage). min/default 0 +
# year max means CloudFront caches exactly as long as the origin says. Cookies
# are excluded from the key so anonymous page views share one cached object
# (pages here are public content; auth lives behind /admin and /api).
#
# CRITICAL: vary the cache key on Next's RSC headers. App-Router prefetches/
# navigations request a page with `RSC: 1` and the origin returns the React
# Flight payload (Content-Type: text/x-component) — the origin Vary's on these.
# Without them in the key, CloudFront caches that RSC payload and serves it to a
# normal browser document request, which then renders the raw Flight text
# instead of HTML. Including them keeps HTML and RSC variants separate.
resource "aws_cloudfront_cache_policy" "pages" {
  count       = local.app_cdn_enabled ? 1 : 0
  name        = "${var.app_name}-pages"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
    cookies_config { cookie_behavior = "none" }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["RSC", "Next-Router-Prefetch", "Next-Router-State-Tree", "Next-Router-Segment-Prefetch"]
      }
    }
    query_strings_config { query_string_behavior = "none" }
  }
}

# ---------------------------------------------------------------------------
# The app distribution
# ---------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "app" {
  count   = local.app_cdn_enabled ? 1 : 0
  enabled = true
  aliases = [var.domain_name, "www.${var.domain_name}"]
  comment = "${var.app_name} app CDN"

  origin {
    domain_name = local.origin_host
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default (pages): cache GET/HEAD per origin Cache-Control, but allow all
  # methods so Next server actions / form POSTs pass through to the origin.
  default_cache_behavior {
    target_origin_id         = "alb"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.pages[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # Immutable hashed build assets — cache hard, forward nothing.
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "alb"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  # Optimized image variants.
  ordered_cache_behavior {
    path_pattern           = "/_next/image*"
    target_origin_id       = "alb"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = aws_cloudfront_cache_policy.next_image[0].id
  }

  # Admin + API: never cache, forward everything (cookies, host, auth).
  ordered_cache_behavior {
    path_pattern             = "/admin*"
    target_origin_id         = "alb"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "alb"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cdn[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${var.app_name}-app-cdn"
  }
}

output "app_cdn_domain" {
  value       = local.app_cdn_enabled ? aws_cloudfront_distribution.app[0].domain_name : null
  description = "CloudFront domain fronting the app (apex + www point here when enabled)."
}
