#!/bin/bash

echo "=== OpenTelemetry Build Fix Validation ==="
echo "Working directory: $(pwd)"
echo "Timestamp: $(date)"
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: package.json not found. Make sure you're in the netlify-ts directory."
    exit 1
fi

echo "✅ Found package.json"

# Backup existing lock file if it exists
if [[ -f "pnpm-lock.yaml" ]]; then
    echo "🔄 Backing up existing pnpm-lock.yaml"
    cp pnpm-lock.yaml pnpm-lock.yaml.backup
fi

echo ""
echo "=== Step 1: Cleaning up existing dependencies ==="

# Remove lock file to regenerate with new versions
if [[ -f "pnpm-lock.yaml" ]]; then
    echo "🗑️  Removing pnpm-lock.yaml"
    rm pnpm-lock.yaml
fi

# Remove node_modules if it exists
if [[ -d "node_modules" ]]; then
    echo "🗑️  Removing node_modules"
    rm -rf node_modules
fi

echo ""
echo "=== Step 2: Installing updated dependencies ==="
echo "📦 Running pnpm install..."
pnpm install
install_exit_code=$?

if [[ $install_exit_code -ne 0 ]]; then
    echo "❌ pnpm install failed with exit code: $install_exit_code"
    exit 1
fi

echo "✅ Dependencies installed successfully"

echo ""
echo "=== Step 3: Running TypeScript build ==="
echo "🔨 Running pnpm run build..."
pnpm run build
build_exit_code=$?

if [[ $build_exit_code -ne 0 ]]; then
    echo "❌ Build failed with exit code: $build_exit_code"
    exit 1
fi

echo "✅ Build completed successfully"

echo ""
echo "=== Step 4: Validating output ==="

# Check if functions directory was created
if [[ ! -d "functions" ]]; then
    echo "❌ functions directory was not created"
    exit 1
fi

echo "✅ functions directory created"

# Check if expected files exist
expected_files=("hello.js" "otel.js")
for file in "${expected_files[@]}"; do
    if [[ -f "functions/$file" ]]; then
        echo "✅ Found functions/$file"
    else
        echo "❌ Missing functions/$file"
        exit 1
    fi
done

echo ""
echo "=== Step 5: Running additional TypeScript validation ==="
echo "🔍 Running npx tsc --noEmit for type checking..."
npx tsc --noEmit
tsc_exit_code=$?

if [[ $tsc_exit_code -ne 0 ]]; then
    echo "❌ TypeScript validation failed with exit code: $tsc_exit_code"
    exit 1
fi

echo "✅ TypeScript validation passed"

echo ""
echo "=== Validation Complete ==="
echo "🎉 All checks passed! The OpenTelemetry instrumentation build is working correctly."
echo ""
echo "Generated files:"
ls -la functions/
echo ""
echo "Next steps:"
echo "1. Test the Netlify function deployment"
echo "2. Verify OpenTelemetry traces are being generated"
echo "3. Check that metrics and logs are working correctly"