::cd /d E:\Dropbox\__important\_implement\gulp
::gulp TeachingEasy
explorer http://localhost:8082/demo/20160826
start cmd /k "%~d0&&sass --watch sass/common.scss:css/common.css --style compressed"