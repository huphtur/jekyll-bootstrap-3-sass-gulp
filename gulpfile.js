var $ = require('gulp-load-plugins')();
var cp = require('child_process');
var argv = require('yargs').argv;
var gulp = require('gulp');
var rimraf = require('rimraf');
var browser = require('browser-sync');
var sequence = require('run-sequence');
var parallelize = require("concurrent-transform");

// Check for --production flag
var isProduction = !!(argv.production);

// Browsers to target when prefixing CSS.
var COMPATIBILITY = ['last 2 versions', 'ie >= 9'];

// File paths to various assets are defined here.
var PATHS = {
  assets: [
    'src/assets/**/*',
    '!src/assets/{img,js,css}/**/*'
  ],
  jekyll: [
    'src/**/*',
    '!src/assets/**/*',
  ],
  sass: [
    'bower_components/bootstrap-sass/assets/stylesheets/bootstrap',
  ],
  javascript: [
    'bower_components/jquery/dist/jquery.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/affix.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/alert.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/button.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/carousel.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/dropdown.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/modal.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/popover.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/scrollspy.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/tab.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/tooltip.js',
    // 'bower_components/bootstrap-sass/assets/javascripts/bootstrap/transition.js',

    'src/assets/js/**/!(app).js',
    'src/assets/js/app.js'
  ]
};

// Delete the "dist" folder
// This happens every time a build starts
gulp.task('clean', function(done) {
  rimraf('dist', done);
});

// Copy files out of the assets folder
// This task skips over the "img", "js", and "scss" folders, which are parsed separately
gulp.task('copy', function() {
  return gulp.src(PATHS.assets)
    .pipe(gulp.dest('dist/assets'));
});

// Build the Jekyll Site
gulp.task('jekyll', function(done) {
  return cp.spawn('jekyll', ['build', '--source', 'src', '--destination', 'dist'], {
      stdio: 'ignore'
    })
    .on('close', done);
});

gulp.task('jekyll:reset', ['jekyll'], function () {
    browser.reload();
});

// Compile Sass into CSS
// In production, the CSS is compressed
gulp.task('sass', function() {
  // var uncss = $.if(isProduction, $.uncss({
  //   html: ['src/**/*.html'],
  //   ignore: [
  //     new RegExp('.foundation-mq'),
  //     new RegExp('^\.is-.*')
  //   ]
  // }));
  //
  // var minifycss = $.if(isProduction, $.minifyCss());

  return gulp.src('src/assets/css/app.scss')
    // .pipe($.sourcemaps.init())
    .pipe($.sass({
      includePaths: PATHS.sass
    })
      .on('error', $.sass.logError))
    .pipe($.autoprefixer({
      browsers: COMPATIBILITY
    }))
    // .pipe(uncss)
    // .pipe(minifycss)
    // .pipe($.if(!isProduction, $.sourcemaps.write()))
    .pipe(gulp.dest('dist/assets/css'))
    .pipe(browser.reload({ stream: true }));
});

// Combine JavaScript into one file
// In production, the file is minified
gulp.task('javascript', function() {
  // var uglify = $.if(isProduction, $.uglify()
  //   .on('error', function (e) {
  //     console.log(e);
  //   }));

  return gulp.src(PATHS.javascript)
    // .pipe($.sourcemaps.init())
    .pipe($.concat('app.js'))
    // .pipe(uglify)
    // .pipe($.if(!isProduction, $.sourcemaps.write()))
    .pipe(gulp.dest('dist/assets/js'))
    .on('finish', browser.reload);
});

// Copy images to the "dist" folder
// In production, the images are compressed
gulp.task('images', function() {
  // var imagemin = $.if(isProduction, $.imagemin({
  //   progressive: true
  // }));

  return gulp.src('src/assets/img/**/*')
    // .pipe(imagemin)
    .pipe(gulp.dest('dist/assets/img'))
    .on('finish', browser.reload);
});

// Build the "dist" folder by running all of the above tasks
gulp.task('build', function(done) {
  sequence('clean', ['jekyll', 'sass', 'javascript', 'images', 'copy'], done);
});

// Start a server with Browsersync to preview the site in
gulp.task('server', ['build'], function() {
  browser.init({
    server: 'dist',
    port: 8000,
    open: false,
    notify: {
      styles: {
        top: 'auto',
        bottom: '0'
      }
    }
  });
});

// Build the site, run the server, and watch for file changes
gulp.task('default', ['build', 'server'], function() {
  gulp.watch(PATHS.assets, ['copy']);
  gulp.watch(PATHS.jekyll, ['jekyll:reset']);
  gulp.watch(['src/assets/css/**/*.css']);
  gulp.watch(['src/assets/css/**/{*.scss, *.sass}'], ['sass']);
  gulp.watch(['src/assets/js/**/*.js'], ['javascript']);
  gulp.watch(['src/assets/img/**/*'], ['images']);
});

// Deploy to AWS S3
gulp.task('deploy', function() {
  var publisher = $.awspublish.create({
    region: 'us-east-1',
    params: {
      Bucket: 'INSERT-BUCKET-NAME-HERE'
    }
  });
  var headers = {
    'Cache-Control': 'max-age=315360000, no-transform, public'
  };
  return gulp.src('dist/**')
    .pipe($.awspublish.gzip())
    .pipe(parallelize(publisher.publish(), 10))
    .pipe(publisher.publish(headers))
    .pipe(publisher.cache())
    .pipe($.awspublish.reporter());
});
