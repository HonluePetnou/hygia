#!/bin/bash
# Crée les ressources AWS simulées au démarrage de LocalStack.
set -euo pipefail

awslocal s3 mb s3://hygia-documents
awslocal s3api put-bucket-versioning --bucket hygia-documents \
  --versioning-configuration Status=Enabled

awslocal s3api create-bucket --bucket hygia-audit --object-lock-enabled-for-bucket \
  --create-bucket-configuration LocationConstraint=eu-west-3

awslocal sqs create-queue --queue-name hygia-ingestion-dlq.fifo \
  --attributes FifoQueue=true
awslocal sqs create-queue --queue-name hygia-ingestion.fifo \
  --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true","RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:eu-west-3:000000000000:hygia-ingestion-dlq.fifo\",\"maxReceiveCount\":\"3\"}"}'

awslocal sns create-topic --name hygia-alertes
awslocal events create-event-bus --name hygia-bus

awslocal dynamodb create-table --table-name hygia-baux \
  --attribute-definitions AttributeName=pk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "HYGIA : ressources LocalStack prêtes"
