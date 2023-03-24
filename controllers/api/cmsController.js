const multilingual = require('../../utils/multilingual');

const Page = require('../../models/pageModel');
const FAQs = require('../../models/faqsModel');

exports.getTerms = async (req, res, next) => {
    try {
        let page = await Page.findOne({ title: 'terms' }).select('-__v -title');
        page = multilingual(page, req);

        res.json({ status: 'success', data: { content: page.content } });
    } catch (error) {
        next(error);
    }
};

exports.getFAQs = async (req, res, next) => {
    try {
        let faqs = await FAQs.find().select('-_id -__v');
        faqs = faqs.map(el => multilingual(el, req));

        res.json({ status: 'success', data: faqs });
    } catch (error) {
        next(error);
    }
};
