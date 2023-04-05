const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const i18n = require('i18next');
const i18nFsBackend = require('i18next-fs-backend');
const i18nMiddleware = require('i18next-http-middleware');

const globalErrorHandler = require('./controllers/errorController');
// const uploadController = require('./controllers/admin/uploadController');

// Start express app
const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Multilingal
i18n.use(i18nFsBackend)
    .use(i18nMiddleware.LanguageDetector)
    .init({
        backend: { loadPath: __dirname + '/locales/{{lng}}.json' },
        fallbackLng: 'en',
        lowerCaseLng: true,
        preload: ['en', 'fr', 'ar'],
        saveMissing: true,
    });

app.use(
    i18nMiddleware.handle(i18n, {
        removeLngFromUrl: false,
    })
);

// 1) GLOBAL MIDDLEWARES

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// session
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(
    require('cookie-session')({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    })
);

// Express Messages middleware
app.use(require('connect-flash')());
app.use(function (req, res, next) {
    res.locals.messages = require('express-messages')(req, res);
    next();
});

// CORS middleware
const cors = require('cors');
app.use(cors());
const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200,
};
app.options('*', cors(corsOptions));

// caching disabled for every route
app.use(function (req, res, next) {
    res.set(
        'Cache-Control',
        'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0'
    );
    next();
});

// end app-assets
app.use('/app-assets/*', (req, res) => res.status(404).end());

// 404 uploads
app.use('/uploads/*', (req, res) => res.status(404).end());

// 2) API ROUTES
// USER ROUTES
app.use('/api/user', require('./routes/user/authRoutes'));
app.use('/api/user', require('./routes/user/profileRoutes'));
app.use('/api/user', require('./routes/user/homeRoutes'));

// DRIVER ROUTES
app.use('/api/driver', require('./routes/driver/authRoutes'));

app.use('/api', require('./routes/user/cityCountryRoutes'));
app.use('/api', require('./routes/user/cmsRoutes'));

// 404 api
app.use('/api', (req, res, next) => {
    next(createError.NotFound(`Can't find ${req.originalUrl} on this server!`));
});

// 3) ADMIN ROUTES
// app.post(
//     '/upload',
//     uploadController.upload.single('upload'),
//     uploadController.uploadCmsImage
// );

app.use(function (req, res, next) {
    res.locals.url = req.originalUrl;
    res.locals.title = 'Dynasty';
    next();
});

app.use('/', require('./routes/admin/authRoutes'));
app.use('/cms', require('./routes/admin/cmsRoutes'));
app.use('/user', require('./routes/admin/userRoutes'));
app.use('/driver', require('./routes/admin/driverRoutes'));
app.use('/', require('./routes/admin/adminRoutes'));

// 404 admin
app.all('/*', (req, res) => {
    res.status(404).render('404', { message: 'Page not found!' });
});

// 4) ERROR HANDLING
app.use(globalErrorHandler);

module.exports = app;
