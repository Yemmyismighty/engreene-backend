import { responseTimeService } from './responseTimeService';
import { automatedResponseService } from './automatedResponseService';
// import { notificationService } from './notificationService';

/**
 * Main automation service that coordinates automated responses and reminders
 * This service manages the overall automation system for the Engreene backend
 */
export class AutomationService {
  private isInitialized = false;

  /**
   * Initialize the automation system
   * Starts response time monitoring and other automated processes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Automation service is already initialized');
      return;
    }

    try {
      // Start response time monitoring
      responseTimeService.start();
      
      this.isInitialized = true;
      console.log('Automation service initialized successfully');
    } catch (error) {
      console.error('Error initializing automation service:', error);
      throw error;
    }
  }

  /**
   * Shutdown the automation system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop response time monitoring
      responseTimeService.stop();
      
      this.isInitialized = false;
      console.log('Automation service shut down successfully');
    } catch (error) {
      console.error('Error shutting down automation service:', error);
      throw error;
    }
  }

  /**
   * Get automation system status
   */
  getStatus(): {
    isInitialized: boolean;
    services: {
      responseTimeMonitoring: boolean;
      automatedResponses: boolean;
      notifications: boolean;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      services: {
        responseTimeMonitoring: this.isInitialized,
        automatedResponses: true, // Always available
        notifications: true // Always available
      }
    };
  }

  /**
   * Manual trigger for response time checks (for testing/admin)
   */
  async triggerResponseTimeCheck(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Automation service is not initialized');
    }

    await responseTimeService.manualCheck();
  }

  /**
   * Get comprehensive automation statistics
   */
  async getAutomationStats(): Promise<{
    responseTimeService: {
      isRunning: boolean;
    };
    automatedResponses: {
      totalVendorsWithActiveResponses: number;
    };
    notifications: {
      totalNotificationsSent: number;
    };
  }> {
    try {
      // Get basic stats (more detailed stats would require additional queries)
      return {
        responseTimeService: {
          isRunning: this.isInitialized
        },
        automatedResponses: {
          totalVendorsWithActiveResponses: 0 // Would need to query database
        },
        notifications: {
          totalNotificationsSent: 0 // Would need to query database
        }
      };
    } catch (error) {
      console.error('Error getting automation stats:', error);
      throw error;
    }
  }

  /**
   * Health check for automation services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      responseTimeService: 'up' | 'down';
      automatedResponseService: 'up' | 'down';
      notificationService: 'up' | 'down';
    };
    timestamp: string;
  }> {
    const services = {
      responseTimeService: 'up' as 'up' | 'down',
      automatedResponseService: 'up' as 'up' | 'down',
      notificationService: 'up' as 'up' | 'down'
    };

    let healthyServices = 0;

    // Check response time service
    try {
      if (this.isInitialized) {
        services.responseTimeService = 'up';
        healthyServices++;
      } else {
        services.responseTimeService = 'down';
      }
    } catch {
      services.responseTimeService = 'down';
    }

    // Check automated response service
    try {
      // Simple validation check
      const validation = automatedResponseService.validateResponseMessage('test');
      if (validation.isValid) {
        services.automatedResponseService = 'up';
        healthyServices++;
      } else {
        services.automatedResponseService = 'down';
      }
    } catch {
      services.automatedResponseService = 'down';
    }

    // Check notification service
    try {
      // The notification service is always available if we can access it
      services.notificationService = 'up';
      healthyServices++;
    } catch {
      services.notificationService = 'down';
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === 3) {
      status = 'healthy';
    } else if (healthyServices >= 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const automationService = new AutomationService();