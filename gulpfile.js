var gulp = require('gulp');

var postcss = require('gulp-postcss');
var sourcemaps = require('gulp-sourcemaps');
var scss = require('postcss-scss');


gulp.task('css', function () {
    var processors = [require('precss'), require('autoprefixer')];

    return gulp.src('src/**/*.css')
        .pipe(sourcemaps.init())
        .pipe(postcss(processors, {syntax: scss}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

gulp.task('w', function () {
    gulp.start('css');

    gulp.watch('src/css/*', function () {
        gulp.start('css');
    });
});

gulp.task('p', function () {


});

// 添加默认任务
gulp.task('default', function () {

});


