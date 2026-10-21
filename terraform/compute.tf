data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (official Ubuntu AMI publisher)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_key_pair" "deployer" {
  key_name   = "smart-campus-key"
  public_key = file("C:/Users/cheta/.ssh/smart-campus-key.pub")
}

resource "aws_instance" "k3s_node" {
  ami                         = "ami-05a3e9423ae4d7a19"
  instance_type               = "t3.small"
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.ec2_sg.id]
  key_name                    = aws_key_pair.deployer.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = "smart-campus-k3s-node"
  }
}

output "instance_public_ip" {
  value = aws_instance.k3s_node.public_ip
}