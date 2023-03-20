const Country = require('../../models/countryModel');
const City = require('../../models/cityModel');

exports.getCountries = async (req, res) => {
    try {
        const countries = await Country.find().sort('-_id');
        res.render('country', { countries });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/');
    }
};

exports.getAddCountry = (req, res) => res.render('country_add');

exports.postAddCountry = async (req, res) => {
    try {
        const image = req.file ? `/uploads/${req.file.filename}` : undefined;

        await Country.create({
            en: { name: req.body.nameEn },
            ar: { name: req.body.nameAr },
            image,
        });

        req.flash('green', 'Country added successfully.');
        res.redirect('/country');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/country');
    }
};

exports.getEditCountry = async (req, res) => {
    try {
        const country = await Country.findById(req.params.id);
        if (!country) {
            req.flash('red', 'Country not found!');
            return res.redirect('/country');
        }

        res.render('country_edit', { country });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'Country not found!');
        else req.flash('red', error.message);
        res.redirect('/country');
    }
};

exports.postEditCountry = async (req, res) => {
    try {
        const country = await Country.findById(req.params.id);
        if (!country) {
            req.flash('red', 'Country not found!');
            return res.redirect('/country');
        }

        country.en.name = req.body.nameEn;
        country.ar.name = req.body.nameAr;

        if (req.file) country.image = `/uploads/${req.file.filename}`;

        await country.save();

        req.flash('green', 'Country edited successfully.');
        res.redirect('/country');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/country');
    }
};

exports.getDeleteCountry = async (req, res) => {
    try {
        // Delele country, cities
        await Promise.all([
            Country.findByIdAndDelete(req.params.id),
            City.deleteMany({ country: req.params.id }),
        ]);

        req.flash('green', 'Country deleted successfully.');
        res.redirect('/country');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Country not found!');
        else req.flash('red', error.message);
        res.redirect('/country');
    }
};

exports.getCities = async (req, res) => {
    try {
        const cities = await City.find().sort('-_id').populate('country', 'en');
        res.render('city', { cities });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/');
    }
};

exports.getAddCity = async (req, res) => {
    try {
        const countries = await Country.find().sort('-_id');
        res.render('city_add', { countries });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/');
    }
};

exports.postAddCity = async (req, res) => {
    try {
        await City.create({
            en: { name: req.body.nameEn },
            ar: { name: req.body.nameAr },
            country: req.body.country,
        });

        req.flash('green', 'City added successfully.');
        res.redirect('/city');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/city');
    }
};

exports.getEditCity = async (req, res) => {
    try {
        const [city, countries] = await Promise.all([
            City.findById(req.params.id),
            Country.find().sort('-_id'),
        ]);

        if (!city) {
            req.flash('red', 'City not found!');
            return res.redirect('/city');
        }

        res.render('city_edit', { city, countries });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'City not found!');
        else req.flash('red', error.message);
        res.redirect('/city');
    }
};

exports.postEditCity = async (req, res) => {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            req.flash('red', 'City not found!');
            return res.redirect('/city');
        }

        city.en.name = req.body.nameEn;
        city.ar.name = req.body.nameAr;
        city.country = req.body.country;

        await city.save();

        req.flash('green', 'City edited successfully.');
        res.redirect('/city');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/city');
    }
};

exports.getDeleteCity = async (req, res) => {
    try {
        await City.findByIdAndDelete(req.params.id);

        req.flash('green', 'City deleted successfully.');
        res.redirect('/city');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'City not found!');
        else req.flash('red', error.message);
        res.redirect('/city');
    }
};
