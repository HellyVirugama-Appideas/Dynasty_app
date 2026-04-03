const User = require('../../models/userModel');
const deleteFile = require("../../utils/deleteFile")
const Ride = require("../../models/rideModel")
const City = require("../../models/cityModel")
const Country = require("../../models/countryModel")
const Address = require("../../models/addressModel")

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('+blocked').sort('-_id');
        res.render('user', { users });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

// exports.viewUser = async (req, res) => {
//     try {
//         const user = await User.findById(req.params.id)
//             .populate('city', 'en.name')
//             .populate('country', 'en.name');

//         if (!user) {
//             req.flash('red', 'User not found!');
//             return res.redirect('/admin/user');
//         }

//         res.render('user_view', { user });
//     } catch (error) {
//         if (error.name === 'CastError') req.flash('red', 'User not found!');
//         else req.flash('red', error.message);
//         res.redirect('/admin/user');
//     }
// };

exports.viewUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('city', 'en.name')
            .populate('country', 'en.name');

        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        // === Calculate Total Money Spent & Total Rides ===
        const rideStats = await Ride.aggregate([
            { $match: { user: user._id } },
            {
                $group: {
                    _id: null,
                    totalMoneySpent: { $sum: "$price" },
                    totalRides: { $sum: 1 },
                    completedRides: {
                        $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
                    },
                    cancelledRides: {
                        $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] }
                    }
                }
            }
        ]);

        const stats = rideStats[0] || {
            totalMoneySpent: 0,
            totalRides: 0,
            completedRides: 0,
            cancelledRides: 0
        };

        // === Fetch Paginated Rides (Latest First) ===
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const rides = await Ride.find({ user: user._id })
            .populate('driver', 'name profile phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalRidesCount = await Ride.countDocuments({ user: user._id });
        const totalPages = Math.ceil(totalRidesCount / limit);

        // === Render the beautiful profile page ===
        res.render('user_view', {  // ← Make sure file name is correct
            title: 'User Profile',
            user,
            rides,
            totalMoneySpent: stats.totalMoneySpent,
            totalRides: stats.totalRides, 
            currentPage: page,
            totalPages
        });
//  res.render('user_view', { user });

    } catch (error) {
        console.log("Error in viewUser:", error);
        req.flash('red', 'Something went wrong!');
        res.redirect('/admin/user');
    }
};

exports.blockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { blocked: true },
            { strict: false }
        );
        req.flash('green', `'${user.name}' blocked successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'User not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};

exports.unblockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { blocked: false },
            { strict: false }
        );
        req.flash('green', `'${user.name}' unblocked successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'User not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};


// EDIT USER - GET
exports.editUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('city', 'en.name')
            .populate('country', 'en.name');

        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        res.render('user_edit', { user });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'User not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};

// UPDATE USER - PUT
exports.updateUser = async (req, res) => {
    try {
        const allowedUpdates = {
            name: req.body.name,
            email: req.body.email,
            country_code: req.body.country_code,
            phone: req.body.phone,
            country: req.body.country || null,
            city: req.body.city || null,
            blocked: req.body.blocked === 'on'
        };

        const user = await User.findByIdAndUpdate(
            req.params.id,
            allowedUpdates,
            { new: true, runValidators: true }
        );

        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        req.flash('green', `'${user.name}' updated successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        req.flash('red', error.message || 'Update failed.');
        res.redirect(`/admin/user/edit/${req.params.id}`);
    }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('red', 'User not found!');
            return res.redirect('/admin/user');
        }

        // Delete profile image
        if (user.profile) {
            deleteFile(`public${user.profile}`);
        }

        await User.findByIdAndDelete(req.params.id);

        req.flash('green', `'${user.name}' deleted successfully.`);
        res.redirect('/admin/user');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/user');
    }
};

// GET - Show create user form
exports.getAddUser = async (req, res) => {
    try {
        const [cities, countries] = await Promise.all([
            City.aggregate([
                { $addFields: { name: '$en.name' } },
                { $unset: ['en', 'fr', 'ar'] },
                { $group: { _id: '$country', cities: { $push: '$$ROOT' } } },
            ]),
            Country.find().sort('en.name'),
        ]);

        res.render('User_add', { cities, countries });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

// POST - Create user
exports.createUserByAdmin = async (req, res, next) => {
    try {
        const {
            name,
            email,
            country_code,
            phone,
            city,
            country,
            address: addressText,
            latitude,
            longitude,
            fcmToken
        } = req.body;

        // Required fields validation
        if (!name || !country_code || !phone || !city || !country || !addressText || !latitude || !longitude) {
            req.flash('red', 'All fields are required: name, phone, city, country, address, latitude, longitude');
            return res.redirect('/admin/user/add');
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { country_code, phone },
                email ? { email } : false
            ].filter(Boolean)
        });

        if (existingUser) {
            req.flash('red', 'User with this phone or email already exists');
            return res.redirect('/admin/user/add');
        }

        // Verify City & Country exist (using ObjectId)
        const [cityDoc, countryDoc] = await Promise.all([
            City.findById(city).lean(),
            Country.findById(country).lean()
        ]);

        if (!cityDoc) {
            req.flash('red', 'Invalid city selected');
            return res.redirect('/admin/user/add');
        }
        if (!countryDoc) {
            req.flash('red', 'Invalid country selected');
            return res.redirect('/admin/user/add');
        }

        // Handle file uploads
        const profile = req.files?.profile?.[0] ? `/uploads/${req.files.profile[0].filename}` : undefined;

        // Create User
        const user = new User({
            name: name.trim(),
            email: email?.trim() || undefined,
            country_code,
            phone,
            city: cityDoc._id,
            country: countryDoc._id,
            profile,
            fcmToken,
            isVerified: true   // Admin-created users are verified by default
        });

        // Create Address
        const address = new Address({
            userId: user._id,
            address: addressText,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            selected: true
        });

        // Validate both
        await user.validate();
        await address.validate();

        // Save both + link address
        await Promise.all([user.save(), address.save()]);
        user.address = address._id;
        await user.save();

        req.flash('green', `User '${user.name}' created successfully.`);
        return res.redirect("/admin/user");

    } catch (error) {
        console.error('Create User Error:', error);
        
        // Delete uploaded files if something fails
        if (req.files) {
            Object.values(req.files).flat().forEach(file => {
                if (file?.path) deleteFile(file.path);
            });
        }

        // Handle duplicate key
        if (error.code === 11000) {
            req.flash('red', 'User already exists with this phone/email');
            return res.redirect('/admin/user/add');
        }

        // Validation errors
        if (error.name === 'ValidationError') {
            req.flash('red', error.message);
            return res.redirect('/admin/user/add');
        }

        req.flash('red', error.message || 'Failed to create user');
        return res.redirect('/admin/user/add');
    }
};

exports.getUserRideDetails = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId)
            .populate({
                path: 'driver',
                select: 'name phone profile rating',
                populate: {
                    path: 'type',
                    select: 'en.name'
                }
            })
            .populate({
                path: 'user',
                select: 'name phone profile'
            })
            .lean();

        if (!ride) {
            return res.status(404).json({ success: false, message: 'Ride not found' });
        }

        res.json({ success: true, ride });

    } catch (error) {
        console.error('Get Ride Details Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}; 
