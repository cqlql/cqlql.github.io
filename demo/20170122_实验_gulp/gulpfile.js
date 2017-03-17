var gulp = require('gulp');


var postcss = require('gulp-postcss');
var sourcemaps = require('gulp-sourcemaps');
var rename  = require('gulp-rename');

var variables = require('postcss-css-variables');
var nested = require('postcss-nested');
var smartImport = require('postcss-smart-import');
var cssnext = require('postcss-cssnext');

var csso = require('gulp-csso');// 压缩css
var deletefile = require('gulp-delete-file');

// 这4个插件足矣
var plugins = [variables,nested,smartImport,cssnext];

gulp.task('css', function () {
    return gulp.src('src/**/test.pcss')
        .pipe(sourcemaps.init())
        .pipe(postcss(plugins))
        .pipe(rename({ extname: '.css' }))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

// 开发用。有map文件
gulp.task('d', function () {
    gulp.start('css');

    gulp.watch('src/css/*', function () {
        gulp.start('css');
    });
});

// 发布用，将压缩css，删除map文件
gulp.task('p', function () {

    gulp.start('deletefile');

    return gulp.src('src/css/test.scss')
        .pipe(postcss(plugins))
        .pipe(csso())
        .pipe(rename({ extname: '.css' }))
        .pipe(gulp.dest('css'));
});

// 添加默认任务
gulp.task('default', function () {
    gulp.start('d');
});


gulp.task('deletefile', function () {
    // var regexp = /.map$/;
    gulp.src(['./dist/css/**/*.map'
    ]).pipe(deletefile({
        // reg: regexp,
        deleteMatch: true
    }))
});
