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
        `I just banked ${ctx.amount} coins in Bird Game 3D! Can you beat that?`,
        `${ctx.amount} coins banked! Bird Game 3D is ridiculously fun`,
        `Just dropped ${ctx.amount} coins at the Sanctuary in Bird Game 3D!`,
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
    case 'achievement':
      return `I just unlocked "${ctx.name}" in Bird Game 3D!`;
    case 'highscore':
      return `New personal best! ${ctx.coins.toLocaleString()} lifetime coins in Bird Game 3D!`;
    case 'streak':
      return `${ctx.count}x hit streak in Bird Game 3D! This game is chaos`;
    case 'level':
      return `I reached Level ${ctx.level} in Bird Game 3D!`;
    case 'generic':
    default: {
      const messages = [
        'Check out Bird Game 3D - the funniest browser game! Poop on everything!',
        'Bird Game 3D is hilarious. Fly around, poop on people, bank your coins. Free in-browser!',
        "I can't stop playing Bird Game 3D. You've been warned.",
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
  }
}
