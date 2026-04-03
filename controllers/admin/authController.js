const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const generateCode = require('../../utils/generateCode');
// const { sendOtp } = require('../../utils/sendMail');

const Admin = require('../../models/adminModel');
const OTP = require('../../models/adminOtpModel');
const User = require('../../models/userModel');
const Driver = require('../../models/driverModel');
const Ride = require("../../models/rideModel") 

exports.checkAdmin = async (req, res, next) => {
    try {
        const token = req.cookies.jwtAdmin;

        if (!token) {
            req.flash('red', 'Please login as admin first!');
            return res.redirect('/admin/login');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded._id);

        if (!admin) {
            req.flash('red', 'Please login as admin first!');
            return res.redirect('/admin/login');
        }

        req.admin = admin;
        res.locals.photo = admin.photo;
        req.session.checkAdminSuccess = undefined;
        next();
    } catch (error) {
        if (error.message == 'invalid signature')
            req.flash('red', 'Invalid token! Please login again.');
        else req.flash('red', error.message);
        res.redirect('/admin/login');
    }
};

// exports.getDashboard = async (req, res) => {
//     const [user, driver] = await Promise.all([
//         User.find().select('date'),
//         Driver.find({ isDeleted: false }).select('date'),
//     ]);

//     // user
//     let newUser = 0;
//     for (let i = 0; i < user.length; i++) if (isToday(user[i].date)) newUser++;

//     // driver
//     let newDriver = 0;
//     for (let i = 0; i < driver.length; i++)
//         if (isToday(driver[i].date)) newDriver++;

//     res.render('index', {
//         user: user.length,
//         newUser,
//         driver: driver.length,
//         newDriver,
//     });
// };

exports.getDashboard = async (req, res) => {
    try {
        // Date ranges
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [
            totalUsers,
            newUsers,
            totalDrivers,
            newDrivers,
            activeRides,
            completedRides,
            cancelledRides,
            expiredRides,
            ridesByStatus
        ] = await Promise.all([
            // Total active users (not soft-deleted)
            User.countDocuments({ isDeleted: { $ne: true } }),

            // New users in last 7 days
            User.countDocuments({
                isDeleted: { $ne: true },
                createdAt: { $gte: sevenDaysAgo }
            }),

            // Total active drivers
            Driver.countDocuments({ isDeleted: { $ne: true } }),

            // New drivers in last 7 days
            Driver.countDocuments({
                isDeleted: { $ne: true },
                createdAt: { $gte: sevenDaysAgo }
            }),

            // Ride counts by status
            Ride.countDocuments({ status: 'Ongoing' }),
            Ride.countDocuments({ status: 'Completed' }),
            Ride.countDocuments({ status: 'Cancelled' }),
            Ride.countDocuments({ status: 'Expired' }),

            // Pie chart: Ride distribution by status (including Expired, Pending, etc.)
            Ride.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ])
        ]);

        // Format data for Chart.js Pie Chart
        const statusChartData = {
            labels: [],
            data: [],
            colors: []
        };

        const statusColors = {
            'Completed': '#4caf50',
            'Ongoing': '#2196f3',
            'Cancelled': '#f44336',
            'Pending': '#ff9800',
            'Expired': '#9e9e9e',
            'Scheduled': '#9c27b0'
        };

        ridesByStatus.forEach(item => {
            const status = item._id || 'Unknown';
            statusChartData.labels.push(status);
            statusChartData.data.push(item.count);
            statusChartData.colors.push(statusColors[status] || '#757575');
        });

        // Optional: Add "No rides yet" if empty
        if (statusChartData.labels.length === 0) {
            statusChartData.labels = ['No Rides'];
            statusChartData.data = [1];
            statusChartData.colors = ['#e0e0e0'];
        }

        // Render dashboard
        res.render('index', {
            // Stats
            user: totalUsers || 0,
            newUser: newUsers || 0,
            driver: totalDrivers || 0,
            newDriver: newDrivers || 0,
            activeRides: activeRides || 0,
            completedRides: completedRides || 0,
            cancelledRides: cancelledRides || 0,
            expiredRides: expiredRides || 0,

            // Chart data (safe for EJS/Handlebars)
            statusChartData: JSON.stringify(statusChartData)
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        req.flash('red', 'Error loading dashboard: ' + error.message);

        // Fallback values on error
        res.render('index', {
            user: 0,
            newUser: 0,
            driver: 0,
            newDriver: 0,
            activeRides: 0,
            completedRides: 0,
            cancelledRides: 0,
            expiredRides: 0,
            statusChartData: JSON.stringify({
                labels: ['Error'],
                data: [1],
                colors: ['#f44336']
            })
        });
    }
};

exports.getLogin = async (req, res) => {
    try {
        if (req.session.checkAdminSuccess) {
            req.session.checkAdminSuccess = undefined;
            return res.render('login');
        }

        const token = req.cookies['jwtAdmin'];
        if (token) {
            const decoded = await promisify(jwt.verify)(
                token,
                process.env.JWT_SECRET
            );
            const admin = await Admin.findById(decoded._id);
            if (!admin) return res.render('login');

            res.redirect('/admin');
        } else {
            res.render('login');
        }
    } catch (error) {
        req.flash('red', error.message);
        res.render('login');
    }
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });

        if (
            !admin ||
            !(await admin.correctPassword(password, admin.password))
        ) {
            req.flash('red', 'Incorrect email or password');
            return res.redirect(req.originalUrl);
        }

        const token = await admin.generateAuthToken();
        res.cookie('jwtAdmin', token, {
            expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            httpOnly: true,
        });
        res.redirect('/admin');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect(req.originalUrl);
    }
};

exports.logout = (req, res) => {
    res.clearCookie('jwtAdmin');
    res.redirect('/admin/login');
};

exports.getForgot = (req, res) => {
    res.clearCookie('jwtAdmin');
    res.render('pass_forgot');
};

exports.postForgot = async (req, res) => {
    try {
        const admin = await Admin.findOne({ email: req.body.email });
        if (!admin) {
            req.flash('red', 'No admin with this email.');
            return res.redirect(req.originalUrl);
        }

        // generate and save OTP
        const otp = generateCode(6);
        await OTP.updateOne(
            { adminId: admin.id },
            { otp, createdAt: Date.now() + 5 * 60 * 1000 },
            { upsert: true }
        );

        console.log(otp);
        // send mail
        // sendOtp(admin.email, otp);

        req.session.adminId = admin.id;
        res.redirect('/admin/reset');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect(req.originalUrl);
    }
};

exports.getReset = (req, res) => {
    if (!req.session.adminId) {
        req.flash('red', 'Please try again.');
        return res.redirect('/admin/forgot');
    }
    res.render('pass_reset', { adminId: req.session.adminId });
};

exports.postReset = async (req, res) => {
    try {
        const admin = await Admin.findById(req.body.adminId);
        if (!admin) {
            req.flash('red', 'No admin with this email.');
            return res.redirect('/admin/forgot');
        }

        // verify otp
        let otp = await OTP.findOne({ adminId: admin.id });
        if (otp?.otp != req.body.otp) {
            req.flash('red', 'OTP is incorrect or expired, Please try again.');
            return res.redirect('/admin/forgot');
        }

        // reset pass
        admin.password = req.body.password;
        admin.passwordConfirm = req.body.passwordConfirm;
        await admin.save();

        req.flash('green', 'Password updated, try logging in.');
        return res.redirect('/admin/login');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/forgot');
    }
};

exports.getChangePass = (req, res) => res.render('change_pass');

exports.postChangePass = async (req, res) => {
    try {
        const { currentpass, newpass, cfnewpass } = req.body;

        if (currentpass == newpass) {
            req.flash(
                'red',
                'New password can not be same as current password.'
            );
            return res.redirect(req.originalUrl);
        }

        const admin = await Admin.findOne({ email: req.admin.email });

        if (!(await admin.correctPassword(currentpass, admin.password))) {
            req.flash('red', 'Your current password is wrong.');
            return res.redirect(req.originalUrl);
        }

        admin.password = newpass;
        admin.passwordConfirm = cfnewpass;
        await admin.save();

        req.flash('green', 'Password updated.');
        return res.redirect(req.originalUrl);
    } catch (error) {
        if (error.name === 'ValidationError') {
            Object.keys(error.errors).forEach(key => {
                req.flash('red', error.errors[key].message);
            });
        } else {
            req.flash('red', error.message);
        }
        return res.redirect(req.originalUrl);
    }
};

const isToday = someDate => {
    const today = new Date();
    return (
        someDate.getDate() == today.getDate() &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear()
    );
};
