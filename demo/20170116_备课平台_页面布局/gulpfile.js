var gulp = require('gulp');

var postcss = require('gulp-postcss');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
// var scss = require('postcss-scss');
var rename  = require('gulp-rename');
var precss = require('precss');
var autoprefixer = require('autoprefixer');
var plugins = [autoprefixer];

var csso = require('gulp-csso');// 压缩css

gulp.task('css', function () {

    return gulp.src('scss/main.scss')

        // .pipe(sourcemaps.init())
        .pipe(postcss(plugins))
        .pipe(sass())
        .pipe(rename({ extname: '.css' }))
        // .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('css'));
});


gulp.task('w', function () {
    gulp.start('css');

    gulp.watch('scss/*', function () {
        gulp.start('css');
    });
});

gulp.task('p', function () {

    return gulp.src('scss/main.scss')
        .pipe(sass())
        .pipe(postcss(plugins))
        .pipe(csso())
        .pipe(rename({ extname: '.css' }))
        .pipe(gulp.dest('css'));
});

// 添加默认任务
gulp.task('default', function () {

});


