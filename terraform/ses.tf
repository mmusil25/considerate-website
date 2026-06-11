# =============================================================================
# SES — transactional email (contact-form notifications).
#
# This account already has a VERIFIED domain identity for the site domain in
# us-east-1, created by Amazon WorkMail (org "consideratesystems") — DKIM
# SUCCESS, VerifiedForSending true. We reuse it instead of provisioning a
# second identity: the app sends via SES in var.ses_region (us-east-1) from
# EMAIL_FROM on that domain.
#
# SANDBOX NOTE: the account does not have SES production access, so it can
# only send TO verified identities. Addresses on the verified domain (the
# WorkMail mailboxes, e.g. mark@consideratesystems.com) qualify — which is why
# notifications target a WorkMail inbox, not an external address. Request SES
# production access before pointing CONTACT_NOTIFY_TO anywhere else.
# =============================================================================

resource "aws_iam_role_policy" "ecs_task_ses" {
  name = "${var.app_name}-ecs-task-ses"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "*"
    }]
  })
}
