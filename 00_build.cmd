
: ## webpack
: 设置项目名称
set project=note

: webpack --config workspace\%project%\webpack.config.js&&pause
cd..&&cd..&&webpack -p --config workspace\%project%\webpack.config.js&&pause
