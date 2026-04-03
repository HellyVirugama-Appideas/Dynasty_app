const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkDriver } = require('../../controllers/driver/authController');
const rentController = require('../../controllers/driver/rentController');

// requests
router.get('/requests', checkDriver, rentController.getRequests);

router.get('/requests/accept/:id', checkDriver, rentController.acceptRequest);

router.post('/requests/reject/:id', checkDriver, rentController.rejectRequest);

// booked
router.get('/booked/:type', checkDriver, rentController.getBookings);

router.post(
    '/cancel_booking',
    fileUpload(),
    checkDriver,
    rentController.cancelBooking
);

module.exports = router;
