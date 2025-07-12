const { getFallbackResponse } = require('../../src/services/fallback');

describe('Fallback Service', () => {
  it('should return a fallback response with the provided error message', () => {
    const errorMessage = 'Something went wrong';
    const response = getFallbackResponse(errorMessage);
    expect(response).toBe(`I am sorry, but I encountered an error. Please try again later. Error: ${errorMessage}`);
  });
});
