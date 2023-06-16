const router = require('express').Router();

const { checkDriver } = require('../../controllers/driver/authController');
const rentController = require('../../controllers/driver/rentController');

router.get('/requests', checkDriver, rentController.getRequests);

router.get('/requests/reject/:id', checkDriver, rentController.rejectRequest);

module.exports = router;
