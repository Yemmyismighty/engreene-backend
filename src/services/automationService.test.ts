import { automationService } from './automationService';

describe('AutomationService', () => {
  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(automationService.initialize()).resolves.not.toThrow();
    });

    it('should handle multiple initialization calls', async () => {
      await automationService.initialize();
      await expect(automationService.initialize()).resolves.not.toThrow();
    });

    it('should shutdown successfully', async () => {
      await automationService.initialize();
      await expect(automationService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('status', () => {
    it('should return correct status when initialized', async () => {
      await automationService.initialize();
      const status = automationService.getStatus();
      
      expect(status.isInitialized).toBe(true);
      expect(status.services.responseTimeMonitoring).toBe(true);
      expect(status.services.automatedResponses).toBe(true);
      expect(status.services.notifications).toBe(true);
      
      await automationService.shutdown();
    });

    it('should return correct status when not initialized', () => {
      const status = automationService.getStatus();
      
      expect(status.isInitialized).toBe(false);
      expect(status.services.responseTimeMonitoring).toBe(false);
      expect(status.services.automatedResponses).toBe(true);
      expect(status.services.notifications).toBe(true);
    });
  });

  describe('health check', () => {
    it('should perform health check', async () => {
      const health = await automationService.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('timestamp');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('manual operations', () => {
    it('should throw error when triggering response check without initialization', async () => {
      await expect(automationService.triggerResponseTimeCheck()).rejects.toThrow(
        'Automation service is not initialized'
      );
    });

    it('should allow manual response check when initialized', async () => {
      await automationService.initialize();
      await expect(automationService.triggerResponseTimeCheck()).resolves.not.toThrow();
      await automationService.shutdown();
    });
  });
});