const router = require('express').Router();

const cmsController = require('../../controllers/user/cmsController');

router.get('/terms', cmsController.getTerms);

router.get('/faqs', cmsController.getFAQs);

module.exports = router;
