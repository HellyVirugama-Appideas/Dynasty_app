const multilingual = require('../../utils/multilingual');

const Country = require('../../models/countryModel');
const City = require('../../models/cityModel');

exports.getCountries = async (req, res, next) => {
    try {
        let countries = await Country.find().sort('en.name');

        countries = countries.map(el => multilingual(el, req));

        res.json({ code: '1', message: req.t('success'), data: { countries } });
    } catch (error) {
        next(error);
    }
};

exports.getCities = async (req, res, next) => {
    try {
        let cities = await City.find({ country: req.body.country_id }).sort(
            'en.name'
        );

        cities = cities.map(el => multilingual(el, req));

        res.json({ code: '1', message: req.t('success'), data: { cities } });
    } catch (error) {
        next(error);
    }
};
