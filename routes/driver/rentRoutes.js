const router = require('express').Router();

const { checkDriver } = require('../../controllers/driver/authController');
const rentController = require('../../controllers/driver/rentController');

// requests
router.get('/requests', checkDriver, rentController.getRequests);

router.get('/requests/accept/:id', checkDriver, rentController.acceptRequest);

router.get('/requests/reject/:id', checkDriver, rentController.rejectRequest);

// booked
router.get('/booked/:type', checkDriver, rentController.getBookings);

module.exports = router;
