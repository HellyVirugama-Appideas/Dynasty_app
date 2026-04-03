const deleteFile = require('../../utils/deleteFile');

const Driver = require('../../models/driverModel');
const City = require('../../models/cityModel');
const Country = require('../../models/countryModel');
const Type = require('../../models/typeModel');
const Ride = require("../../models/rideModel")

exports.getAllDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find({ isDeleted: false })
            .select('+approved +blocked')
            .sort('-_id');

        res.render('driver', { drivers });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.getAddDriver = async (req, res) => {
    try {
        const [cities, countries, types] = await Promise.all([
            City.aggregate([
                { $addFields: { name: '$en.name' } },
                { $unset: ['en', 'fr', 'ar'] },
                { $group: { _id: '$country', cities: { $push: '$$ROOT' } } },
            ]),
            Country.find().sort('en.name'),
            Type.find(),
        ]);

        res.render('driver_add', { cities, countries, types });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.postAddDriver = async (req, res) => {
    try {
        // 1. Extract file paths
        const profile = req.files?.profile?.[0] ? `/uploads/${req.files.profile[0].filename}` : undefined;
        const licence = req.files?.licence?.[0] ? `/uploads/${req.files.licence[0].filename}` : undefined;
        const pan = req.files?.pan?.[0] ? `/uploads/${req.files.pan[0].filename}` : undefined;
        const rc = req.files?.rc?.[0] ? `/uploads/${req.files.rc[0].filename}` : undefined;

        // 2. Create driver
        await Driver.create({
            name: req.body.name,
            email: req.body.email,
            country_code: req.body.country_code,
            phone: req.body.phone,
            city: req.body.city,
            country: req.body.country,
            address: req.body.address,
            type: req.body.type,
            profile,
            licence,
            pan,
            rc,
            approved: true,
        });

        req.flash('green', 'Driver added successfully.');
        res.redirect('/admin/driver');
    } catch (error) {
        // 3. Delete uploaded files on error
        const files = [
            req.files?.profile?.[0],
            req.files?.licence?.[0],
            req.files?.pan?.[0],
            req.files?.rc?.[0]
        ].filter(Boolean);

        files.forEach(file => deleteFile(file.path));

        if (error.code === 11000) {
            req.flash('red', `${Object.values(error.keyValue)[0]} is already registered.`);
        } else {
            req.flash('red', error.message);
        }
        res.redirect('/admin/driver');
    }
};

exports.getEditDriver = async (req, res) => {
    try {
        const [driver, cities, countries, types] = await Promise.all([
            Driver.findById(req.params.id),
            City.aggregate([
                { $addFields: { name: '$en.name' } },
                { $unset: ['en', 'fr', 'ar'] },
                { $group: { _id: '$country', cities: { $push: '$$ROOT' } } },
            ]),
            Country.find().sort('en.name'),
            Type.find(),
        ]);

        const citiesInSelectedCountry = cities.find(
            item => item._id == driver.country?.toString()
        )?.cities;

        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        res.render('driver_edit', {
            driver,
            cities,
            countries,
            types,
            citiesInSelectedCountry,
        });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.postEditDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) {
            // Delete new files if driver not found
            const files = [
                req.files?.profile?.[0],
                req.files?.licence?.[0],
                req.files?.pan?.[0],
                req.files?.rc?.[0]
            ].filter(Boolean);
            files.forEach(file => deleteFile(file.path));

            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // 1. Update text fields
        driver.name = req.body.name;
        driver.email = req.body.email;
        driver.country_code = req.body.country_code;
        driver.phone = req.body.phone;
        driver.country = req.body.country || undefined;
        driver.city = req.body.city || undefined;
        driver.address = req.body.address;
        driver.type = req.body.type || undefined;

        // 2. Handle file updates
        if (req.files?.profile?.[0]) {
            if (driver.profile) deleteFile(`public${driver.profile}`);
            driver.profile = `/uploads/${req.files.profile[0].filename}`;
        }
        if (req.files?.licence?.[0]) {
            if (driver.licence) deleteFile(`public${driver.licence}`);
            driver.licence = `/uploads/${req.files.licence[0].filename}`;
        }
        if (req.files?.pan?.[0]) {
            if (driver.pan) deleteFile(`public${driver.pan}`);
            driver.pan = `/uploads/${req.files.pan[0].filename}`;
        }
        if (req.files?.rc?.[0]) {
            if (driver.rc) deleteFile(`public${driver.rc}`);
            driver.rc = `/uploads/${req.files.rc[0].filename}`;
        }

        await driver.save();

        req.flash('green', 'Driver edited successfully.');
        res.redirect('/admin/driver');
    } catch (error) {
        // Delete new files on error
        const files = [
            req.files?.profile?.[0],
            req.files?.licence?.[0],
            req.files?.pan?.[0],
            req.files?.rc?.[0]
        ].filter(Boolean);
        files.forEach(file => deleteFile(file.path));

        req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.blockDriver = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { blocked: true },
            { strict: false }
        );
        req.flash('green', `'${driver.name}' blocked successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.unblockDriver = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { blocked: false },
            { strict: false }
        );
        req.flash('green', `'${driver.name}' unblocked successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.approveDriver = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { approved: true },
            { strict: false }
        );

        req.flash('green', `'${driver.name}' approved successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};
exports.deleteDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // Delete uploaded files
        const files = [driver.profile, driver.licence, driver.pan, driver.rc]
            .filter(Boolean)
            .map(path => `public${path}`);
        files.forEach(file => deleteFile(file));

        await Driver.findByIdAndDelete(req.params.id);

        req.flash('green', `'${driver.name}' deleted successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.viewDriver = async (req, res) => {
    try {
        const driverId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        // Fetch Driver with all details
        const driver = await Driver.findById(driverId)
            .select('+blocked +approved +rating')
            .populate('city', 'en.name')
            .populate('country', 'en.name')
            .populate('type', 'en.name');

        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // Fetch Rides for this driver with pagination
        const ridesQuery = Ride.find({ driver: driverId })
            .populate('user', 'name phone profile')
            .sort({ createdAt: -1 });

        const totalRides = await Ride.countDocuments({ driver: driverId });
        const rides = await ridesQuery
            .skip((page - 1) * limit)
            .limit(limit);

        const totalPages = Math.ceil(totalRides / limit);

        // Calculate Earnings
        const completedRides = await Ride.find({
            driver: driverId,
            status: 'Completed'
        });

        const totalMoneyEarned = completedRides.reduce((sum, ride) => sum + (ride.price || 0), 0);

        // Today's Earnings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEarnings = completedRides
            .filter(ride => new Date(ride.createdAt) >= today)
            .reduce((sum, ride) => sum + (ride.price || 0), 0);

        // Monthly Earnings
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const monthlyEarnings = completedRides
            .filter(ride => new Date(ride.createdAt) >= thisMonth)
            .reduce((sum, ride) => sum + (ride.price || 0), 0);

        // Render the new beautiful profile page
        res.render('driver_view', {
            title: 'Dynasty Admin',
            driver,
            rides,
            totalMoneyEarned,
            totalRides: completedRides.length,
            todayEarnings,
            monthlyEarnings,
            currentPage: page,
            totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            req // agar flash message chahiye to
        });

    } catch (error) {
        console.error('Error in viewDriver:', error);
        if (error.name === 'CastError') {
            req.flash('red', 'Invalid Driver ID!');
        } else {
            req.flash('red', 'Something went wrong while loading driver profile');
        }
        res.redirect('/admin/driver');
    }
};

//  NEW: Get Driver Ride Details (AJAX endpoint for modal)
exports.getDriverRideDetails = async (req, res) => {
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

//  NEW: Get Driver Earnings Report
exports.getDriverEarningsReport = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id).select('name');

        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        // Get earnings by month for last 12 months
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyEarnings = await Ride.aggregate([
            {
                $match: {
                    driver: driver._id,
                    status: 'Completed',
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalEarnings: { $sum: '$price' },
                    rideCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            driver: driver.name,
            monthlyEarnings
        });

    } catch (error) {
        console.error('Get Earnings Report Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};


///////////////driver approval

////driver document approve
// View driver documents for approval
exports.viewDriverDocuments = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id)
            .populate('city', 'en.name')
            .populate('country', 'en.name')
            .populate('type', 'en.name');

        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // Build documents object with approval status
        const documents = {
            licence: {
                title: 'Driver Licence',
                url: driver.licence,
                uploaded: !!driver.licence,
                approved: driver.licenceApproved || false,
                rejected: driver.licenceRejected || false,
                rejectionReason: driver.licenceRejectionReason
            },
            pan: {
                title: 'PAN Card',
                url: driver.pan,
                uploaded: !!driver.pan,
                approved: driver.panApproved || false,
                rejected: driver.panRejected || false,
                rejectionReason: driver.panRejectionReason
            },
            rc: {
                title: 'RC',
                url: driver.rc,
                uploaded: !!driver.rc,
                approved: driver.rcApproved || false,
                rejected: driver.rcRejected || false,
                rejectionReason: driver.rcRejectionReason
            }
        };

        const allDocumentsUploaded = Object.values(documents).every(doc => doc.uploaded);
        const allDocumentsApproved = Object.values(documents).every(doc => doc.approved);
        const anyDocumentRejected = Object.values(documents).some(doc => doc.rejected);

        res.render('driver_documents', {
            driver,
            documents,
            allDocumentsUploaded,
            allDocumentsApproved,
            anyDocumentRejected
        });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};


exports.approveDocument = async (req, res) => {
    try {
        const { id, docType } = req.params;

        // Validate document type
        const validDocTypes = ['profile', 'licence', 'pan', 'rc'];
        if (!validDocTypes.includes(docType)) {
            req.flash('red', 'Invalid document type!');
            return res.redirect(`/admin/driver/vuew_driver/${id}`);
        }

        const driver = await Driver.findById(id);
        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // Check if document is uploaded
        if (!driver[docType]) {
            req.flash('red', `${docType.toUpperCase()} document is not uploaded yet!`);
            return res.redirect(`/admin/driver/${id}`);
        }

        // Approve the specific document
        const approvalField = `${docType}Approved`;
        const rejectionField = `${docType}Rejected`;
        const rejectionReasonField = `${docType}RejectionReason`;

        driver[approvalField] = true;
        driver[rejectionField] = false;
        driver[rejectionReasonField] = null;
        await driver.save();

        req.flash('green', `${docType.toUpperCase()} document approved successfully.`);
        res.redirect(`/admin/driver/documents/${id}`);
    } catch (error) {
        req.flash('red', error.message);
        res.redirect(`/admin/driver/documents/${req.params.id}`);
    }
};

// Reject single document with reason
// exports.rejectDocument = async (req, res) => {
//     try {
//         const { id, docType } = req.params;
//         const { reason } = req.body;

//         // Validate document type
//         const validDocTypes = ['profile', 'licence', 'pan', 'rc'];
//         if (!validDocTypes.includes(docType)) {
//             req.flash('red', 'Invalid document type!');
//             return res.redirect(`/admin/driver/documents/${id}`);
//         }

//         const driver = await Driver.findById(id);
//         if (!driver) {
//             req.flash('red', 'Driver not found!');
//             return res.redirect('/admin/driver');
//         }

//         // Check if document is uploaded
//         if (!driver[docType]) {
//             req.flash('red', `${docType.toUpperCase()} document is not uploaded yet!`);
//             return res.redirect(`/admin/driver/documents/${id}`);
//         }

//         if (!reason || reason.trim() === '') {
//             req.flash('red', 'Please provide a rejection reason!');
//             return res.redirect(`/admin/driver/documents/${id}`);
//         }

//         // Reject the specific document
//         const approvalField = `${docType}Approved`;
//         const rejectionField = `${docType}Rejected`;
//         const rejectionReasonField = `${docType}RejectionReason`;

//         driver[approvalField] = false;
//         driver[rejectionField] = true;
//         driver[rejectionReasonField] = reason.trim();
//         await driver.save();

//         req.flash('green', `${docType.toUpperCase()} document rejected. Driver will be notified.`);
//         res.redirect(`/admin/driver/documents/${id}`);
//     } catch (error) {
//         req.flash('red', error.message);
//         res.redirect(`/admin/driver/documents/${req.params.id}`);
//     }
// };
// exports.rejectDocument = async (req, res) => {
//     try {
//         const { id, docType } = req.params;
//         const { reason } = req.body;

//         // ... validation (same as before)

//         const driver = await Driver.findById(id).select('+fcmToken');
//         if (!driver) return redirectWithError('/admin/driver', 'Driver not found!');

//         // ... reject logic

//         const docTitles = { profile: 'Profile Photo', licence: 'Driver Licence', pan: 'PAN Card', rc: 'RC Document' };

//         const notificationData = {
//             title: `${docTitles[docType]} Rejected`,
//             body: `Your ${docTitles[docType].toLowerCase()} was rejected.\nReason: ${reason.trim()}\nPlease re-upload.`,
//             type: 'document_rejection',
//             docType,
//             reason: reason.trim(),
//             driverId: driver._id.toString()
//         };

//         // === USE NEW FUNCTION ===
//         if (driver.fcmToken) {
//             await sendDocumentRejectionNotification(driver.fcmToken, notificationData);
//         }

//         // Socket.IO
//         io.to(driver._id.toString()).emit('documentRejected', notificationData);

//         req.flash('green', `${docTitles[docType]} rejected & driver notified.`);
//         res.redirect(`/admin/driver/documents/${id}`);

//     } catch (error) {
//         req.flash('red', 'Failed to reject document.');
//         res.redirect(`/admin/driver/documents/${req.params.id}`);
//     }
// };

// rejectDocument
exports.rejectDocument = async (req, res) => {
    try {
        console.log('=== REJECT DOCUMENT START ===');
        console.log('Params:', req.params);
        console.log('Body:', req.body);

        const { id, docType } = req.params;
        const { reason } = req.body;

        // Validation
        const validDocTypes = ['profile', 'licence', 'pan', 'rc'];
        if (!validDocTypes.includes(docType)) {
            console.log('Invalid docType:', docType);
            req.flash('red', 'Invalid document type!');
            return res.redirect(`/admin/driver/documents/${id}`);
        }

        const driver = await Driver.findById(id).select('+fcmToken');
        if (!driver) {
            console.log('Driver not found:', id);
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        if (!driver[docType]) {
            console.log(`${docType} not uploaded`);
            req.flash('red', `${docType.toUpperCase()} not uploaded!`);
            return res.redirect(`/admin/driver/documents/${id}`);
        }

        if (!reason?.trim()) {
            console.log('Reason missing');
            req.flash('red', 'Rejection reason is required!');
            return res.redirect(`/admin/driver/documents/${id}`);
        }

        // === REJECT LOGIC ===
        const approvalField = `${docType}Approved`;
        const rejectionField = `${docType}Rejected`;
        const rejectionReasonField = `${docType}RejectionReason`;

        driver[approvalField] = false;
        driver[rejectionField] = true;
        driver[rejectionReasonField] = reason.trim();

        console.log('Saving driver...');
        await driver.save();
        console.log('Driver saved successfully');

        // === NOTIFICATION ===
        const docTitles = { profile: 'Profile Photo', licence: 'Driver Licence', pan: 'PAN Card', rc: 'RC Document' };

        const notificationData = {
            title: `${docTitles[docType]} Rejected`,
            body: `Your ${docTitles[docType].toLowerCase()} was rejected.\nReason: ${reason.trim()}\nPlease re-upload.`,
            type: 'document_rejection',
            docType,
            reason: reason.trim(),
            driverId: driver._id.toString()
        };

        console.log('Sending FCM...');
        if (driver.fcmToken) {
            const result = await sendDocumentRejectionNotification(driver.fcmToken, notificationData);
            console.log('FCM Result:', result);
        } else {
            console.log('No FCM Token');
        }

        // Socket.IO
        // io.to(driver._id.toString()).emit('documentRejected', notificationData);

        req.flash('green', `${docTitles[docType]} rejected & driver notified.`);
        res.redirect(`/admin/driver/documents/${id}`);

    } catch (error) {
        // FULL ERROR LOG
        console.error('REJECT DOCUMENT ERROR:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('Full Error:', error);

        req.flash('red', `Failed to reject document: ${error.message}`);
        res.redirect(`/admin/driver/documents/${req.params.id}`);
    }
};

// Approve ALL documents and driver together (ATOMIC)
exports.approveDriverAndDocuments = async (req, res) => {
    try {
        const driverId = req.params.id;

        const driver = await Driver.findById(driverId);
        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // Check if 3 required documents are uploaded (profile handled separately)
        const requiredDocs = [
            { field: 'licence', name: 'Driver Licence' },
            { field: 'pan', name: 'PAN Card' },
            { field: 'rc', name: 'RC Document' }
        ];

        const missingDocs = requiredDocs.filter(doc => !driver[doc.field]);

        if (missingDocs.length > 0) {
            const missingNames = missingDocs.map(d => d.name).join(', ');
            req.flash('red', `Cannot approve driver. Missing documents: ${missingNames}`);
            return res.redirect(`/admin/driver/documents/${driverId}`);
        }

        // ATOMIC OPERATION: Approve driver + all documents (including profile)
        const updateData = {
            // Approve driver
            approved: true,

            // Approve all 4 documents (profile auto-approved with driver)
            profileApproved: true,
            licenceApproved: true,
            panApproved: true,
            rcApproved: true,

            // Clear any rejection flags
            profileRejected: false,
            licenceRejected: false,
            panRejected: false,
            rcRejected: false,

            // Clear rejection reasons
            profileRejectionReason: null,
            licenceRejectionReason: null,
            panRejectionReason: null,
            rcRejectionReason: null,

            // Track approval
            approvedAt: new Date()
        };

        await Driver.findByIdAndUpdate(
            driverId,
            updateData,
            {
                new: true,
                runValidators: false
            }
        );

        req.flash('green', `✅ Driver '${driver.name}' and documents (Licence, PAN, RC) approved! Driver can now accept rides.`);
        res.redirect('/admin/driver');
    } catch (error) {
        console.error('Approval Error:', error);
        req.flash('red', 'Failed to approve driver. Please try again.');
        res.redirect(`/admin/driver/documents/${req.params.id}`);
    }
};

// Reject driver completely with reason
// exports.rejectDriverCompletely = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { reason } = req.body;

//         const driver = await Driver.findById(id);
//         if (!driver) {
//             req.flash('red', 'Driver not found!');
//             return res.redirect('/admin/driver');
//         }

//         if (!reason || reason.trim() === '') {
//             req.flash('red', 'Please provide a rejection reason!');
//             return res.redirect(`/admin/driver/documents/${id}`);
//         }

//         // Reject driver and mark all documents as rejected
//         const updateData = {
//             approved: false,

//             // Mark all documents as rejected
//             profileApproved: false,
//             licenceApproved: false,
//             panApproved: false,
//             rcApproved: false,

//             profileRejected: true,
//             licenceRejected: true,
//             panRejected: true,
//             rcRejected: true,

//             // Same rejection reason for all
//             profileRejectionReason: reason.trim(),
//             licenceRejectionReason: reason.trim(),
//             panRejectionReason: reason.trim(),
//             rcRejectionReason: reason.trim(),

//             rejectedAt: new Date()
//         };

//         await Driver.findByIdAndUpdate(id, updateData);

//         req.flash('green', `❌ Driver '${driver.name}' and all documents rejected. Driver will be notified to re-upload.`);
//         res.redirect('/admin/driver');
//     } catch (error) {
//         req.flash('red', error.message);
//         res.redirect('/admin/driver');
//     }
// };

exports.rejectDriverCompletely = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const driver = await Driver.findById(id).select('+fcmToken');
        if (!driver) return redirectWithError('/admin/driver', 'Driver not found!');

        // ... reject all logic

        const notificationData = {
            title: 'Registration Rejected',
            body: `Your driver registration was rejected.\nReason: ${reason.trim()}\nPlease re-upload all documents.`,
            type: 'registration_rejected',
            reason: reason.trim(),
            driverId: driver._id.toString()
        };

        // === USE NEW FUNCTION ===
        if (driver.fcmToken) {
            await sendDocumentRejectionNotification(driver.fcmToken, notificationData);
        }

        io.to(driver._id.toString()).emit('registrationRejected', notificationData);

        req.flash('green', `Driver rejected & notified.`);
        res.redirect('/admin/driver');

    } catch (error) {
        req.flash('red', 'Failed to reject driver.');
        res.redirect('/admin/driver');
    }
};

// Get pending drivers (not approved yet)
exports.getPendingDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find({
            isDeleted: false,
            approved: false
        })
            .populate('city', 'en.name')
            .populate('country', 'en.name')
            .populate('type', 'en.name')
            .sort('-createdAt');

        res.render('driver_pending', { drivers });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.userList = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default: Last 3 years from today
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    let filter = {
      date: { $gte: threeYearsAgo }
    };

    // If custom date range provided, use it
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      filter.date = {
        $gte: start,
        $lte: end
      };
    }

    const users = await User.find(filter).sort({ date: -1 });

    return res.render("admin/user/list", {
      title: "User List",
      users,
      selectedStartDate: startDate || '',
      selectedEndDate: endDate || '',
      totalRecords: users.length
    });

  } catch (error) {
    console.log("User List Error:", error);
    req.flash("error", "Something went wrong!");
    return res.redirect("back");
  }
};
