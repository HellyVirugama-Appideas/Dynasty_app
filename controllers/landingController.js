const Message = require('../models/messageModel.js');

exports.home = (req, res) => {
    let language;
    if (req.cookies.language) {
        if (req.cookies.language == 'en') language = 'en';
        else if (req.cookies.language == 'fr') language = 'fr';
    } else if (req.headers['accept-language']?.startsWith('en')) {
        res.cookie('language', 'en');
        language = 'en';
    }

    if (language == 'en') res.render('landing/landing_eng');
    else res.render('landing/landing');
};

exports.fr = (req, res) => {
    res.cookie('language', 'fr');
    res.redirect('/');
};

exports.en = (req, res) => {
    res.cookie('language', 'en');
    res.redirect('/');
};

exports.privacy = (req, res) => {
    if (req.cookies.language == 'en') res.render('landing/privacy_eng');
    else res.render('landing/privacy');
};

exports.terms = (req, res) => {
    if (req.cookies.language == 'en') res.render('landing/terms_eng');
    else res.render('landing/terms');
};

exports.contact = async (req, res) => {
    try {
        await Message.create(req.body);

        // message per language
        if (req.cookies.language == 'en')
            res.send('Message sent successfully.');
        else res.send('Message envoyé avec succès.');
    } catch (error) {
        console.log(error);
        res.send('Oops! An error occured and your message could not be sent.');
    }
};
