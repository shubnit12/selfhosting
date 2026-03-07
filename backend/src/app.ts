import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { CORS_CONFIG, SERVER_CONFIG } from './config/constants';
import { generalRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import logger from './utils/logger';
import SwaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// ========================================
// CREATE EXPRESS APP
// ========================================

const app: Application = express();

// ========================================
// SECURITY MIDDLEWARE
// ========================================

// Helmet - Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    },
    hsts: SERVER_CONFIG.NODE_ENV === 'production' ? {
        maxAge: 31536000,  // 1 year
        includeSubDomains: true,
        preload: true
    } : false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));

// CORS - Cross-Origin Resource Sharing
app.use(cors({
    origin: CORS_CONFIG.ORIGIN,
    credentials: CORS_CONFIG.CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ========================================
// BODY PARSING MIDDLEWARE
// ========================================

// Parse JSON bodies
app.use(express.json({ 
    limit: '10mb',
    strict: true,
    type: 'application/json'
}));

// Parse URL-encoded bodies
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 50000
}));

// ========================================
// LOGGING MIDDLEWARE
// ========================================

// Log all requests
app.use((req, res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    next();
});

// ========================================
// RATE LIMITING
// ========================================

// Apply general rate limiting to all routes
app.use('/api', generalRateLimiter);

// ========================================
// API ROUTES
// ========================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: SERVER_CONFIG.NODE_ENV
    });
});

app.use('/api-docs', SwaggerUi.serve, SwaggerUi.setup(swaggerSpec,{
    customCss: '.swagger-ui .topbar { display: none}',
    customSiteTitle: 'Self Hosted backend apis',
    swaggerOptions: {
        persistAuthorization: true
    }
}))

// Mount API routes
app.use('/api', apiRoutes);

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ========================================
// EXPORT APP
// ========================================

export default app;