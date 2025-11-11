const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const i18n = require('i18next');
const i18nFsBackend = require('i18next-fs-backend');
const i18nMiddleware = require('i18next-http-middleware');
const cron = require('node-cron');
const stripeWebhook = require('./controllers/user/Paymentcontroller.js');

const landingController = require('./controllers/landingController');
const globalErrorHandler = require('./controllers/errorController');
const updateExpiredBookings = require('./utils/updateExpiredBookings');
const updateRideStatus = require('./utils/updateRideStatus');
const Driver = require('./models/driverModel');
const Address = require('./models/addressModel');
const User = require('./models/userModel');
const Car = require('./models/carModel');
const userPaymentRoutes = require('./routes/user/paymentRoutes');
// const webhookRoutes = require('./routes/webhookRoutes');
const methodOverride = require('method-override');

// Start express app
const app = express();

app.post(
    '/api/user/stripe/webhook',
    express.raw({ type: 'application/json' }),
    stripeWebhook.stripeWebhook
);
// app.use('/api/webhooks', webhookRoutes);

app.use(methodOverride('_method'));
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
app.use('/api/user', require('./routes/user/rideRoutes'));
app.use('/api/user', require('./routes/user/rentRoutes'));
app.use('/api/user', userPaymentRoutes);

// DRIVER ROUTES
app.use('/api/driver', require('./routes/driver/authRoutes'));
app.use('/api/driver', require('./routes/driver/homeRoutes'));
app.use('/api/driver', require('./routes/driver/rideRoutes'));
app.use('/api/driver/car', require('./routes/driver/carRoutes'));
app.use('/api/driver', require('./routes/driver/rentRoutes'));
app.use('/api/driver', require('./routes/driver/profileRoutes'));
app.use('/api/driver', require('./routes/driver/paymentRoutes'));

app.use('/api', require('./routes/user/cityCountryRoutes'));
app.use('/api', require('./routes/user/cmsRoutes'));

// 404 api
app.use('/api', (req, res, next) => {
    next(createError.NotFound(`Can't find ${req.originalUrl} on this server!`));
});

// 3) ADMIN ROUTES
app.use(function (req, res, next) {
    res.locals.url = req.originalUrl;
    res.locals.title = 'Dynasty';
    next();
});

app.use('/admin/', require('./routes/admin/authRoutes'));
app.use('/admin/cms', require('./routes/admin/cmsRoutes'));
app.use('/admin/user', require('./routes/admin/userRoutes'));
app.use('/admin/message', require('./routes/admin/messageRoutes'));
app.use('/admin/driver', require('./routes/admin/driverRoutes'));
app.use('/admin/', require('./routes/admin/adminRoutes'));

// 404 admin
app.all('/admin/*', (req, res) => {
    res.status(404).render('404', { message: 'Page not found!' });
});

// 4) LANDING ROUTES
app.get('/', landingController.home);
app.get('/fr', landingController.fr);
app.get('/en', landingController.en);
app.get('/privacy', landingController.privacy);
app.get('/terms', landingController.terms);
app.post('/contact', landingController.contact);

app.get('/request-delete-user', (req, res) => {
    res.render('request-delete-user'); // views/request-delete.ejs
});

app.post('/request-delete-user', async (req, res) => {
    const { email, reason } = req.body;

    if (!email) {
        return res.render('request-delete-user', {
            errorMessage: 'Email and password are required.',
        });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('request-delete-user', {
                errorMessage: 'No user found with this email.',
            });
        }

        // const isMatch = await bcrypt.compare(password, user.password);
        // if (!isMatch) {
        //     return res.render('request-delete-user', {
        //         errorMessage: 'Incorrect password.',
        //     });
        // }

        // Delete user and their addresses
        await Promise.all([
            User.findByIdAndDelete(user._id),
            Address.deleteMany({ userId: user._id }),
        ]);

        res.render('request-delete-user', {
            successMessage: 'Your account has been deleted successfully.',
        });
    } catch (err) {
        console.error(err);
        res.render('request-delete-user', {
            errorMessage: 'An error occurred while processing your request.',
        });
    }
});

app.get('/request-delete-driver', (req, res) => {
    res.render('request-delete-driver'); // views/request-delete.ejs
});

app.post('/request-delete-driver', async (req, res, next) => {
    const { email, reason } = req.body;

    if (!email) {
        return res.render('request-delete-user', {
            errorMessage: 'Email and password are required.',
        });
    }

    try {
        const driver = await Driver.findOne({ email });

        if (!driver) {
            return res.render('request-delete-driver', {
                errorMessage: 'Driver not found with this email.',
            });
        }

        // Mark driver as deleted
        await Driver.findByIdAndUpdate(driver._id, { isDeleted: true });

        // Mark driver's car as deleted
        await Car.findOneAndUpdate(
            { driver: driver._id, isDeleted: false },
            { isDeleted: true }
        );

        // Obfuscate email
        const suffix = uniqueSuffix();
        await Driver.findByIdAndUpdate(driver._id, {
            email: driver.email + suffix,
        });

        res.render('request-delete-driver', {
            successMessage: 'Your account has been deleted successfully.',
        });
    } catch (err) {
        next(err);
    }
});
const uniqueSuffix = () => {
    const random = Math.random().toString(36).substr(2, 3);
    return `_deleted_${random}`;
};
app.get('/*', (req, res) => res.redirect('/'));

// 5) ERROR HANDLING
app.use(globalErrorHandler);

// 6) CRON JOB
// Schedule the job to run every hour
cron.schedule('0 * * * *', () => {
    updateExpiredBookings();
    updateRideStatus();
});

module.exports = app;
