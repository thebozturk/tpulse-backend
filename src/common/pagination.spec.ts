import { buildPaged, toSkipTake } from './pagination';

describe('pagination', () => {
  describe('buildPaged', () => {
    it('should compute totalPages by ceiling division', () => {
      // Arrange
      const items = [1, 2, 3];

      // Act
      const result = buildPaged(items, 25, 2, 10);

      // Assert
      expect(result).toEqual({
        items,
        page: 2,
        pageSize: 10,
        totalCount: 25,
        totalPages: 3,
      });
    });

    it('should return totalPages 0 when totalCount is 0', () => {
      const result = buildPaged([], 0, 1, 20);
      expect(result.totalPages).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('should return totalPages 1 when totalCount equals pageSize', () => {
      const result = buildPaged([], 20, 1, 20);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('toSkipTake', () => {
    it('should map page/pageSize to skip/take', () => {
      expect(toSkipTake(1, 20)).toEqual({ skip: 0, take: 20 });
      expect(toSkipTake(3, 15)).toEqual({ skip: 30, take: 15 });
    });
  });
});
