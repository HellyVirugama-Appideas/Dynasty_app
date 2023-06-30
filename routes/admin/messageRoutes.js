const router = require('express').Router();

const messageController = require('../../controllers/admin/messageController');

router.get('/', messageController.getAllMessages);

router.get('/:id', messageController.viewMessage);

module.exports = router;
