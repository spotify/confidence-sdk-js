#!/bin/bash

# This script prepares the server files for packaging by:
# 1. Creating a server directory
# 2. Copying server files from dist/
# 3. Renaming them to index.* to support proper module resolution

set -e  # Exit on any error

# Create server directory if it doesn't exist
mkdir -p ./server

# Copy all server files from dist to server directory
cp dist/server.* ./server/

# Change to server directory for renaming
cd server

# Rename all server.* files to index.*
mv server.cjs index.cjs
mv server.mjs index.mjs
mv server.d.ts index.d.ts
mv server.cjs.map index.cjs.map
mv server.mjs.map index.mjs.map 