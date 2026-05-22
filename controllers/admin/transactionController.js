const Transaction = require('../../models/transaction');
const Wallet = require('../../models/wallet');

// GET - All Transactions (User + Driver)
exports.getAllTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const filterType = req.query.type || 'all';

        // Commission totals aggregate (for summary cards)
        const commissionStats = await Transaction.aggregate([
            { $match: { status: 'completed', adminCommission: { $gt: 0 } } },
            {
                $group: {
                    _id: '$type',
                    totalCommission: { $sum: '$adminCommission' },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        let totalAdminCommission = 0;
        let rideCommissionTotal = 0;
        let rentCommissionTotal = 0;

        commissionStats.forEach(stat => {
            totalAdminCommission += stat.totalCommission;
            if (stat._id === 'ride_payment') rideCommissionTotal = stat.totalCommission;
            if (stat._id === 'rent car') rentCommissionTotal = stat.totalCommission;
        });

        if (filterType === 'user') {
            const userTransactions = await Transaction.find()
                .populate('userId', 'name email phone')
                .populate('rideId', 'pickupAddress endAddress price status')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const totalUser = await Transaction.countDocuments();

            return res.render('transactions', {
                title: 'Dynasty Admin',
                userTransactions,
                driverTransactions: [],
                filterType,
                totalPages: Math.ceil(totalUser / limit),
                currentPage: page,
                totalUser,
                totalDriver: 0,
                totalAdminCommission,
                rideCommissionTotal,
                rentCommissionTotal,
            });
        }

        if (filterType === 'driver') {
            const driverTransactions = await Wallet.find({ driverId: { $exists: true, $ne: null } })
                .populate('driverId', 'name email phone')
                .populate('rideId', 'pickupAddress endAddress price status')
                .populate('bookingId', 'price status')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const totalDriver = await Wallet.countDocuments({ driverId: { $exists: true, $ne: null } });

            return res.render('transactions', {
                title: 'Dynasty Admin',
                userTransactions: [],
                driverTransactions,
                filterType,
                totalPages: Math.ceil(totalDriver / limit),
                currentPage: page,
                totalUser: 0,
                totalDriver,
                totalAdminCommission,
                rideCommissionTotal,
                rentCommissionTotal,
            });
        }

        // All - both
        const [userTransactions, driverTransactions, totalUser, totalDriver] = await Promise.all([
            Transaction.find()
                .populate('userId', 'name email phone')
                .populate('rideId', 'pickupAddress endAddress price status')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),

            Wallet.find({ driverId: { $exists: true, $ne: null } })
                .populate('driverId', 'name email phone')
                .populate('rideId', 'pickupAddress endAddress price status')
                .populate('bookingId', 'price status')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),

            Transaction.countDocuments(),
            Wallet.countDocuments({ driverId: { $exists: true, $ne: null } }),
        ]);

        res.render('transactions', {
            title: 'Dynasty Admin',
            userTransactions,
            driverTransactions,
            filterType,
            totalPages: 1,
            currentPage: 1,
            totalUser,
            totalDriver,
            totalAdminCommission,
            rideCommissionTotal,
            rentCommissionTotal,
        });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};
