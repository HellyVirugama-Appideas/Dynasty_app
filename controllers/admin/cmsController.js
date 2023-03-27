const Page = require('../../models/pageModel');
const FAQs = require('../../models/faqsModel');

exports.getTerms = async (req, res) => {
    try {
        const page = await Page.findOne({ title: 'terms' });

        res.render('terms', { page });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/');
    }
};

exports.postTerms = async (req, res) => {
    try {
        const page = await Page.findOne({ title: 'terms' });
        page.en.content = req.body.EnContent;
        page.fr.content = req.body.FrContent;
        page.ar.content = req.body.ArContent;
        await page.save();

        req.flash('green', 'Terms & Conditions updated successfully.');
        res.redirect('/cms/terms');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect(req.originalUrl);
    }
};

exports.getFAQs = async (req, res) => {
    try {
        const faqs = await FAQs.find().sort('-_id');
        res.render('faqs', { faqs });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/');
    }
};

exports.getAddFAQ = (req, res) => res.render('faqs_add');

exports.postAddFAQ = async (req, res) => {
    try {
        await FAQs.create({
            en: {
                question: req.body.EnQue,
                answer: req.body.EnAns,
            },
            fr: {
                question: req.body.FrQue,
                answer: req.body.FrAns,
            },
            ar: {
                question: req.body.ArQue,
                answer: req.body.ArAns,
            },
        });

        req.flash('green', 'FAQ added successfully.');
        res.redirect('/cms/faqs');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect(req.originalUrl);
    }
};

exports.getEditFAQ = async (req, res) => {
    try {
        const faq = await FAQs.findById(req.params.id);
        if (faq == null) {
            req.flash('red', 'FAQ not found!');
            return res.redirect('/cms/faqs');
        }

        res.render('faqs_edit', { faq });
    } catch (error) {
        if (error.name === 'CastError') {
            req.flash('red', 'FAQ not found!');
            res.redirect('/cms/faqs');
        } else {
            req.flash('red', error.message);
            res.redirect('/cms/faqs');
        }
    }
};

exports.postEditFAQ = async (req, res) => {
    try {
        const faq = await FAQs.findById(req.params.id);
        if (faq == null) {
            req.flash('red', 'FAQ not found!');
            return res.redirect('/cms/faqs');
        }

        faq.en.question = req.body.EnQue;
        faq.en.answer = req.body.EnAns;
        faq.fr.question = req.body.FrQue;
        faq.fr.answer = req.body.FrAns;
        faq.ar.question = req.body.ArQue;
        faq.ar.answer = req.body.ArAns;
        await faq.save();

        req.flash('green', 'FAQ edited successfully.');
        res.redirect('/cms/faqs');
    } catch (error) {
        if (error.name === 'CastError') {
            req.flash('red', 'FAQ not found!');
            res.redirect('/cms/faqs');
        } else {
            req.flash('red', error.message);
            res.redirect(req.originalUrl);
        }
    }
};

exports.getdeleteFAQ = async (req, res) => {
    try {
        await FAQs.findByIdAndRemove(req.params.id);

        req.flash('green', 'FAQ deleted successfully.');
        res.redirect('/cms/faqs');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError') {
            req.flash('red', 'FAQ not found!');
            res.redirect('/cms/faqs');
        } else {
            req.flash('red', error.message);
            res.redirect('/cms/faqs');
        }
    }
};
