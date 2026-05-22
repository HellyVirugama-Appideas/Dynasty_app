const router = require('express').Router();

const commissionController = require('../../controllers/admin/commissionController');
const transactionController = require('../../controllers/admin/transactionController');
const ridesController = require('../../controllers/admin/ridesController');
const authController = require('../../controllers/admin/authController');

// Protect all routes below with admin auth check
router.use(authController.checkAdmin);

// Commission Routes
router.route('/commission')
    .get(commissionController.getCommission)
    .post(commissionController.postCommission);

// Transaction Routes
router.get('/transactions', transactionController.getAllTransactions);

// Rides Routes
router.get('/rides', ridesController.getRides);

// Bookings / Rent Routes
router.get('/bookings', ridesController.getBookings);

module.exports = router;
