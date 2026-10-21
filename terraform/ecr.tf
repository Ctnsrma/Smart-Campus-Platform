locals {
  services = [
    "auth-service",
    "student-service",
    "course-service",
    "attendance-service",
    "notification-service",
    "analytics-service",
    "api-gateway"
  ]
}

resource "aws_ecr_repository" "services" {
  for_each = toset(local.services)

  name                 = "smart-campus/${each.value}"
  image_tag_mutability = "MUTABLE"

  force_delete = true

  tags = {
    Name = "smart-campus-${each.value}"
  }
}

output "ecr_repository_urls" {
  value = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}