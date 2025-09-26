import { Sequelize } from 'sequelize';
import { logger } from '../utils/logger';

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://localhost:5432/onebox', {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ESOCKETTIMEDOUT/,
      /EHOSTUNREACH/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 3
  }
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');
    
    // Sync models
    await sequelize.sync({ alter: true });
    logger.info('✅ Database models synchronized');
  } catch (error) {
    logger.error('❌ Failed to initialize database:', error);
    
    // In production, we might want to continue without database
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️ Continuing without database in production mode');
      return;
    }
    
    throw error;
  }
};

export { sequelize };