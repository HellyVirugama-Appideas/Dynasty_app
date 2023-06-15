const router = require('express').Router();

const { checkDriver } = require('../../controllers/driver/authController');
const rentController = require('../../controllers/driver/rentController');

router.get('/requests', checkDriver, rentController.getRequests);

module.exports = router;
