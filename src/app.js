const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');
const { morganMiddleware } = require('./utils/logger.util');
const { errorMiddleware } = require('./middlewares/error.middleware');
const videoRoutes = require('./routes/video.routes');
const { viewsDir, publicDir } = require('./config/storage.config');

const app = express();

// Security headers (relax CSP slightly for inline video + styles)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        mediaSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

app.use(compression());
app.use(morganMiddleware);

// View engine
app.set('view engine', 'ejs');
app.set('views', viewsDir);
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Static assets
app.use(express.static(publicDir));

// Body parsing (for future form fields)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Routes
app.use('/', videoRoutes);

// Centralised error handler
app.use(errorMiddleware);

module.exports = app;
