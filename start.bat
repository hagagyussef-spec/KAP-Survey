@echo off
chcp 65001 >nul
cls

echo ========================================================
echo 🚀 تطبيق متابعة الأعمال - سكريبت التثبيت والتشغيل
echo ========================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js غير مثبت على جهازك
    echo 📥 يرجى تثبيت Node.js من: https://nodejs.org/
    echo 🔗 اختر النسخة LTS ^(Long Term Support^)
    pause
    exit /b 1
)

echo ✅ تم العثور على Node.js
node -v
echo.

REM Check if npm is installed
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm غير مثبت على جهازك
    echo 📥 يرجى إعادة تثبيت Node.js من: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ تم العثور على npm
npm -v
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 جاري تثبيت المتطلبات...
    call npm install
    echo.
    echo ✅ تم تثبيت المتطلبات بنجاح
    echo.
)

echo ========================================================
echo 🎯 جاري تشغيل التطبيق...
echo ========================================================
echo.

REM Start the server
npm start

pause
