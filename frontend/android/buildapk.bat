@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\ominfo35\AppData\Local\Android\Sdk
cd /d C:\Users\ominfo35\Desktop\DriverTRACK\frontend\android
gradlew.bat assembleDebug --no-daemon
