import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: `.env.${process.env['NODE_ENV'] || 'development'}` });

interface Config {
  environment: string;
  server: {
    port: number;
    host: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  redis: {
    url: string;
    password: string | undefined;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  frontend: {
    url: string;
  };
  business: {
    commissionRate: number;
    responseReminderHours: number[];
  };
  socketIO: {
    corsOrigin: string;
  };
}

const config: Config = {
  environment: process.env['NODE_ENV'] || 'development',
  server: {
    port: parseInt(process.env['PORT'] || '3001', 10),
    host: process.env['HOST'] || 'localhost',
  },
  supabase: {
    url: process.env['SUPABASE_URL'] || '',
    anonKey: process.env['SUPABASE_ANON_KEY'] || '',
    serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
  },
  redis: {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    password: process.env['REDIS_PASSWORD'],
  },
  jwt: {
    secret: process.env['JWT_SECRET'] || 'fallback_secret_change_in_production',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
  },
  frontend: {
    url: process.env['FRONTEND_URL'] || 'http://localhost:3000',
  },
  business: {
    commissionRate: parseFloat(process.env['COMMISSION_RATE'] || '0.10'),
    responseReminderHours: (process.env['RESPONSE_REMINDER_HOURS'] || '8,24,48,168')
      .split(',')
      .map(h => parseInt(h.trim(), 10)),
  },
  socketIO: {
    corsOrigin: process.env['SOCKET_IO_CORS_ORIGIN'] || 'http://localhost:3000',
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missingEnvVars = requiredEnvVars.filter(
  envVar => !process.env[envVar]
);

if (missingEnvVars.length > 0 && config.environment !== 'test') {
  console.warn(
    `⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`
  );
  console.warn('Please check your .env file configuration');
}

export { config };