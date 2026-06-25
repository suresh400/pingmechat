#!/bin/bash
# install-mongodb.sh — Run this script to install MongoDB on Ubuntu/Debian
# Usage: sudo bash install-mongodb.sh

set -e

echo "📦 Installing MongoDB 7.0..."

curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
  tee /etc/apt/sources.list.d/mongodb-org-7.0.list

apt-get update -q
apt-get install -y mongodb-org

systemctl start mongod
systemctl enable mongod

echo ""
echo "✅ MongoDB installed and started!"
echo "   URI: mongodb://127.0.0.1:27017/pingmechat"
mongod --version
