const Commission = require('../../models/commissionModel');

// GET - Commission Settings Page
exports.getCommission = async (req, res) => {
    try {
        let commission = await Commission.findOne();
        if (!commission) {
            // Create a default record if none exists
            commission = await Commission.create({
                rideCommission: 0,
                rentCommission: 0,
                commissionType: 'percentage',
            });
        }
        res.render('commission', { commission, title: 'Dynasty Admin' });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

// POST - Save Commission Settings
exports.postCommission = async (req, res) => {
    try {
        const { rideCommission, rentCommission, commissionType } = req.body;

        const rideVal = parseFloat(rideCommission);
        const rentVal = parseFloat(rentCommission);

        if (isNaN(rideVal) || rideVal < 0) {
            req.flash('red', 'Ride commission must be a positive number.');
            return res.redirect('/admin/commission');
        }
        if (isNaN(rentVal) || rentVal < 0) {
            req.flash('red', 'Rent commission must be a positive number.');
            return res.redirect('/admin/commission');
        }
        if (commissionType === 'percentage' && (rideVal > 100 || rentVal > 100)) {
            req.flash('red', 'Percentage commission cannot exceed 100%.');
            return res.redirect('/admin/commission');
        }

        const type = commissionType || 'percentage';

        // findOneAndUpdate with upsert — agar record nahi hai toh bhi create ho jayega
        await Commission.findOneAndUpdate(
            {}, // match first record
            {
                $set: {
                    rideCommission: rideVal,
                    rentCommission: rentVal,
                    commissionType: type,
                }
            },
            { upsert: true, new: true }
        );

        console.log(`[Commission] Updated — ride: ${rideVal}${type === 'percentage' ? '%' : ' fixed'}, rent: ${rentVal}${type === 'percentage' ? '%' : ' fixed'}`);

        req.flash('green', `Commission updated successfully. Ride: ${rideVal}${type === 'percentage' ? '%' : ' fixed'}, Rent: ${rentVal}${type === 'percentage' ? '%' : ' fixed'}`);
        res.redirect('/admin/commission');
    } catch (error) {
        console.error('[Commission] Save error:', error);
        req.flash('red', error.message);
        res.redirect('/admin/commission');
    }
};
