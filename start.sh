#!/bin/bash

# تطبيق متابعة الأعمال - سكريبت التثبيت والتشغيل

echo "========================================================"
echo "🚀 تطبيق متابعة الأعمال - سكريبت التثبيت والتشغيل"
echo "========================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js غير مثبت على جهازك"
    echo "📥 يرجى تثبيت Node.js من: https://nodejs.org/"
    echo "🔗 اختر النسخة LTS (Long Term Support)"
    exit 1
fi

echo "✅ تم العثور على Node.js (الإصدار: $(node -v))"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm غير مثبت على جهازك"
    echo "📥 يرجى إعادة تثبيت Node.js من: https://nodejs.org/"
    exit 1
fi

echo "✅ تم العثور على npm (الإصدار: $(npm -v))"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 جاري تثبيت المتطلبات..."
    npm install
    echo ""
    echo "✅ تم تثبيت المتطلبات بنجاح"
    echo ""
fi

echo "========================================================"
echo "🎯 جاري تشغيل التطبيق..."
echo "========================================================"
echo ""

# Start the server
npm start
