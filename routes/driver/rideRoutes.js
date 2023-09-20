const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkDriver } = require('../../controllers/driver/authController');
const rideController = require('../../controllers/driver/rideController');

// Rides
router.get('/rides', checkDriver, rideController.getRides);

router.post('/verify_ride_otp', fileUpload(), rideController.verifyRideOTP);

module.exports = router;
