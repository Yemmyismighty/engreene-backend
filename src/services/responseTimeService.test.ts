import { responseTimeService } from './responseTimeService';

describe('ResponseTimeService', () => {
  describe('calculateHoursElapsed', () => {
    it('should calculate hours correctly', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      // Access private method through any cast for testing
      const hours = (responseTimeService as any).calculateHoursElapsed(twoHoursAgo.toISOString());
      expect(hours).toBe(2);
    });

    it('should handle recent messages', () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      const hours = (responseTimeService as any).calculateHoursElapsed(thirtyMinutesAgo.toISOString());
      expect(hours).toBe(0);
    });
  });

  describe('service lifecycle', () => {
    it('should start and stop service', () => {
      expect(() => {
        responseTimeService.start();
        responseTimeService.stop();
      }).not.toThrow();
    });

    it('should handle multiple start calls gracefully', () => {
      expect(() => {
        responseTimeService.start();
        responseTimeService.start(); // Should not throw
        responseTimeService.stop();
      }).not.toThrow();
    });
  });
});