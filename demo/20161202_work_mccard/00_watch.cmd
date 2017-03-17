
: ## webpack
: 设置项目名称
:: set project=note
:: cd..&&cd..&&webpack -w -d --config workspace\%project%\webpack.config.js&&pause
:: start cmd /k "cd..&&cd..&&webpack -w -d --config workspace\%project%\webpack.config.js"


: ## sass
start cmd /c "sass sass/main.scss:css/main.css --style expanded --watch --no-cache"