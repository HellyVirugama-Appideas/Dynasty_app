const router = require('express').Router();

const cmsController = require('../../controllers/admin/cmsController');

router
    .route('/terms')
    .get(cmsController.getTerms)
    .post(cmsController.postTerms);

router.get('/faqs', cmsController.getFAQs);
router
    .route('/faqs/add')
    .get(cmsController.getAddFAQ)
    .post(cmsController.postAddFAQ);
router
    .route('/faqs/edit/:id')
    .get(cmsController.getEditFAQ)
    .post(cmsController.postEditFAQ);
router.get('/faqs/delete/:id', cmsController.getdeleteFAQ);

module.exports = router;
