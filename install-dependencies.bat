@echo off
echo ========================================
echo Installation des dependances UI/UX
echo ========================================
echo.

echo Installation de expo-blur...
call npm install expo-blur@~15.0.8

echo.
echo Installation de react-native-svg...
call npm install react-native-svg@~16.14.0

echo.
echo ========================================
echo Installation terminee !
echo ========================================
echo.
echo Vous pouvez maintenant lancer l'app avec: npm start
pause
