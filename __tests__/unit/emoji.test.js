// __tests__/emoji.test.js
const emojiManager = require('../../src/utils/emoji');

describe('EmojiManager', () => {
  it('adds the correct emoji for known keywords', () => {
    expect(emojiManager.addEmojisToResponse('I am happy')).toContain('😊');
    expect(emojiManager.addEmojisToResponse('This is awesome')).toContain('😎');
    expect(emojiManager.addEmojisToResponse('Much love')).toContain('❤️');
  });

  it('does not modify the text if no keyword is present', () => {
    expect(emojiManager.addEmojisToResponse('Nothing matches here')).toBe('Nothing matches here');
  });

  it('is case-insensitive', () => {
    expect(emojiManager.addEmojisToResponse('HELP me')).toContain('🆘');
  });

  it('can add multiple emojis', () => {
    const result = emojiManager.addEmojisToResponse('Thanks and congratulations');
    expect(result).toContain('🎉');
    expect(result).toContain('🙏');
  });

  it('does not add emoji for keywords inside other words', () => {
    expect(emojiManager.addEmojisToResponse('helpful person')).toBe('helpful person');
  });

  it('adds all matching emojis', () => {
    const result = emojiManager.addEmojisToResponse('happy love sad');
    expect(result).toContain('😊');
    expect(result).toContain('❤️');
    expect(result).toContain('😢');
  });

  it('handles empty string', () => {
    expect(emojiManager.addEmojisToResponse('')).toBe('');
  });

  it('can get reactions for a message', () => {
    const reactions = emojiManager.getReactionsForMessage('happy sad');
    expect(reactions).toContain('😊');
    expect(reactions).toContain('😢');
  });
});
