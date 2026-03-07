export type ShareContext =
  | { type: 'banking'; amount: number }
  | { type: 'achievement'; name: string }
  | { type: 'highscore'; coins: number }
  | { type: 'streak'; count: number }
  | { type: 'level'; level: number }
  | { type: 'generic' };

export function generateShareText(ctx: ShareContext): string {
  switch (ctx.type) {
    case 'banking': {
      const messages = [
        `I just tucked away ${ctx.amount} coins at the Sanctuary in Bird Game 3D.`,
        `${ctx.amount} coins settled safely in Bird Game 3D.`,
        `Just banked ${ctx.amount} coins after a cozy city glide in Bird Game 3D.`,
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
    case 'achievement':
      return `I just unlocked "${ctx.name}" in Bird Game 3D!`;
    case 'highscore':
      return `New personal best: ${ctx.coins.toLocaleString()} lifetime coins in Bird Game 3D!`;
    case 'streak':
      return `Rode a ${ctx.count}x streak through the sky in Bird Game 3D.`;
    case 'level':
      return `I reached Level ${ctx.level} in Bird Game 3D!`;
    case 'generic':
    default: {
      const messages = [
        'Check out Bird Game 3D, a cozy browser flyer about gliding, exploring, and a little mischief.',
        'Bird Game 3D is a relaxed little sky sandbox: soar, collect, and settle coins at the Sanctuary.',
        'Bird Game 3D has cozy city flights, shiny collectibles, and just enough chaos.',
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
  }
}
