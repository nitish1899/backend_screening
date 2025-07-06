import dotenv from 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import database from './config/database.js';
import { logger } from './config/logger.js';
import { initializeModels } from './models/index.js';
import {
    handleUncaughtException,
    handleUnhandledRejection,
    handleSigterm
} from './middleware/errorHandler.js';
import app from './app.js';
import { initializeWebSocket } from './utils/collaboration.js';

// Handle uncaught exceptions
handleUncaughtException();

const startServer = async () => {
    try {
        // Connect to database
        await database.connect();
        logger.info('Database connected successfully');

        // Initialize models
        await initializeModels();

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize Socket.IO
        const io = new SocketIOServer(server, {
            cors: {
                origin: process.env.CLIENT_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        // Initialize WebSocket handlers
        initializeWebSocket(io);

        // Start server
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
            logger.info('WebSocket server initialized');
        });

        // Handle unhandled promise rejections
        handleUnhandledRejection(server);

        // Handle SIGTERM
        handleSigterm(server);

        return server;
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();