const Message = require('../../models/messageModel');

exports.getAllMessages = async (req, res) => {
    try {
        const msgs = await Message.find().sort('-_id');
        res.render('message', { msgs });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.viewMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            req.flash('red', 'Message not found!');
            return res.redirect('/admin/message');
        }

        res.render('message_view', { message });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'Message not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/message');
    }
};
