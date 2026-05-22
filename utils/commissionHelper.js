// const Commission = require('../models/commissionModel');

// /**
//  * Commission settings fetch karo DB se
//  * Har baar fresh query — taaki admin update karne ke baad turant reflect ho
//  */
// const getCommissionSettings = async () => {
//     const commission = await Commission.findOne().lean();
//     if (commission) {
//         console.log('[Commission] Settings loaded from DB:', {
//             ride: commission.rideCommission,
//             rent: commission.rentCommission,
//             type: commission.commissionType,
//         });
//         return commission;
//     }
//     console.log('[Commission] No settings in DB, using defaults: ride=0, rent=0');
//     return { rideCommission: 0, rentCommission: 0, commissionType: 'percentage' };
// };

// /**
//  * Commission calculate karo
//  * @param {number} totalAmount - Total transaction amount (in same unit as stored — cents ya rupees)
//  * @param {string} type - 'ride_payment' | 'rent car' | 'bike'
//  * @returns {{ adminCommission, driverAmount, commissionRate, commissionType }}
//  */
// const calculateCommission = async (totalAmount, type) => {
//     const settings = await getCommissionSettings();

//     const isRent = type === 'rent car';
//     const rate = isRent ? Number(settings.rentCommission) : Number(settings.rideCommission);
//     const commissionType = settings.commissionType || 'percentage';

//     let adminCommission = 0;

//     if (commissionType === 'percentage') {
//         // e.g. rate = 20 means 20%
//         adminCommission = Math.round((totalAmount * rate) / 100);
//     } else {
//         // Fixed amount — stored as plain number (same unit as totalAmount)
//         adminCommission = Math.min(Math.round(rate), totalAmount);
//     }

//     const driverAmount = totalAmount - adminCommission;

//     console.log(`[Commission] type=${type} | total=${totalAmount} | rate=${rate}${commissionType === 'percentage' ? '%' : ' fixed'} | commission=${adminCommission} | driver=${driverAmount}`);

//     return {
//         adminCommission,
//         driverAmount,
//         commissionRate: rate,
//         commissionType,
//     };
// };

// module.exports = { calculateCommission, getCommissionSettings };


const Commission = require('../models/commissionModel');

/**
 * Commission settings fetch karo DB se
 * Har baar fresh query — taaki admin update ke baad turant reflect ho
 */
const getCommissionSettings = async () => {
    const commission = await Commission.findOne().lean();
    if (commission) {
        console.log('[Commission] Settings loaded from DB:', {
            ride: commission.rideCommission,
            rent: commission.rentCommission,
            type: commission.commissionType,
        });
        return commission;
    }
    console.log('[Commission] No settings in DB, using defaults: ride=0, rent=0');
    return { rideCommission: 0, rentCommission: 0, commissionType: 'percentage' };
};

/**
 * Commission calculate karo
 *
 * IMPORTANT: totalAmount ALWAYS in CENTS (e.g. ₹29.53 = 2953 cents)
 * commissionRate ALWAYS in human-readable units:
 *   - percentage: 0-100 (e.g. 20 means 20%)
 *   - fixed: actual currency amount (e.g. 15 means ₹15 = 1500 cents)
 *
 * @param {number} totalAmount - Total amount in CENTS
 * @param {string} type        - 'ride_payment' | 'rent car' | 'bike'
 * @returns {{ adminCommission, driverAmount, commissionRate, commissionType }}
 *          adminCommission and driverAmount are in CENTS
 */
const calculateCommission = async (totalAmount, type) => {
    const settings = await getCommissionSettings();

    const isRent = type === 'rent car';
    const rate = isRent ? Number(settings.rentCommission) : Number(settings.rideCommission);
    const commissionType = settings.commissionType || 'percentage';

    let adminCommission = 0;

    if (commissionType === 'percentage') {
        // rate = 20 means 20% of totalAmount (in cents)
        adminCommission = Math.round((totalAmount * rate) / 100);
    } else {
        // Fixed: rate is in rupees/dollars (e.g. 15 = ₹15)
        // Convert to cents: ₹15 → 1500 cents
        const rateInCents = Math.round(rate * 100);
        adminCommission = Math.min(rateInCents, totalAmount);
    }

    const driverAmount = totalAmount - adminCommission;

    console.log(
        `[Commission] type=${type} | ` +
        `total=${totalAmount} cents (₹${(totalAmount/100).toFixed(2)}) | ` +
        `rate=${rate}${commissionType === 'percentage' ? '%' : ' fixed (₹' + rate + ')'} | ` +
        `commission=${adminCommission} cents (₹${(adminCommission/100).toFixed(2)}) | ` +
        `driver=${driverAmount} cents (₹${(driverAmount/100).toFixed(2)})`
    );

    return {
        adminCommission,  // in cents
        driverAmount,     // in cents
        commissionRate: rate,
        commissionType,
    };
};

module.exports = { calculateCommission, getCommissionSettings };
