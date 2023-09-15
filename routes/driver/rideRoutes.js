const router = require('express').Router();

const { checkDriver } = require('../../controllers/driver/authController');
const rideController = require('../../controllers/driver/rideController');

// Rides
router.get('/rides', checkDriver, rideController.getRides);

module.exports = router;
